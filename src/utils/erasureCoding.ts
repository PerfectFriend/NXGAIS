/**
 * NeXXUs Protocol - Real Erasure Coding & Zero-Knowledge ChaCha20-Poly1305 Engine
 * Specification v2.0
 * 
 * - Galois Field GF(2^8) Matrix Erasure Coding:
 *   Default: 4 Data Shards + 2 Parity Shards (Total 6 Shards, Quorum = 4)
 *   Any 4 out of 6 shards can mathematically reconstruct the exact original 16KB payload!
 * - Zero-Knowledge Chunk Cryptography:
 *   Derives symmetric per-chunk key from User's Vault Master Key (BIP-44 m/44'/9999'/0'/1'/0) + chunkIndex
 *   Authentic ChaCha20-Poly1305 AEAD streaming encryption & decryption
 */

import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Galois Field GF(256) primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const GF_SIZE = 256;
const GF_POLY = 0x11d;

const expTable = new Uint8Array(512);
const logTable = new Uint8Array(GF_SIZE);

// Initialize logarithm and exponent tables for fast GF(2^8) arithmetic
(function initGfTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    expTable[i] = x;
    expTable[i + 255] = x;
    logTable[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= GF_POLY;
    }
  }
  logTable[0] = 0; // Boundary condition
})();

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return expTable[logTable[a] + logTable[b]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(256)');
  if (a === 0) return 0;
  return expTable[(logTable[a] - logTable[b] + 255) % 255];
}

export function gfInv(a: number): number {
  if (a === 0) throw new Error('Zero has no inverse in GF(256)');
  return expTable[255 - logTable[a]];
}

export interface ErasureShard {
  shardIndex: number;  // 0..3: Data Shards, 4..5: Parity Shards
  isParity: boolean;
  shardHash: string;   // SHA-256 of this shard
  data: Uint8Array;
}

export interface ErasureEncodingResult {
  originalLength: number;
  dataShardsCount: number;   // 4
  parityShardsCount: number; // 2
  totalShards: number;       // 6
  shardSize: number;         // 16384 / 4 = 4096 bytes
  shards: ErasureShard[];
}

/**
 * Standard Cauchy/Vandermonde Generator Matrix coefficients for (4 + 2) RS-coding.
 * Parity P1 = D0 * 1 ^ D1 * 1 ^ D2 * 1 ^ D3 * 1 (XOR parity)
 * Parity P2 = D0 * a0 ^ D1 * a1 ^ D2 * a2 ^ D3 * a3 (Vandermonde row with distinct non-zero elements)
 */
const PARITY_COEFFS_P2 = [1, 2, 4, 8];

/**
 * Encodes a 16KB (or arbitrary size) byte array into 4 data shards + 2 parity shards.
 */
export function encodeReedSolomon4plus2(data: Uint8Array): ErasureEncodingResult {
  const K = 4; // Data shards
  const M = 2; // Parity shards
  const originalLength = data.length;
  const shardSize = Math.ceil(originalLength / K);

  // Split into K data shards (with zero padding if needed)
  const shardsData: Uint8Array[] = [];
  for (let i = 0; i < K; i++) {
    const shard = new Uint8Array(shardSize);
    const start = i * shardSize;
    const end = Math.min(originalLength, start + shardSize);
    if (start < originalLength) {
      shard.set(data.subarray(start, end), 0);
    }
    shardsData.push(shard);
  }

  // Generate Parity Shard 1 (Simple XOR sum across all 4 data shards)
  const p1 = new Uint8Array(shardSize);
  for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
    let acc = 0;
    for (let k = 0; k < K; k++) {
      acc ^= shardsData[k][byteIdx];
    }
    p1[byteIdx] = acc;
  }

  // Generate Parity Shard 2 (Vandermonde GF(2^8) weighted multiplication)
  const p2 = new Uint8Array(shardSize);
  for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
    let acc = 0;
    for (let k = 0; k < K; k++) {
      const coeff = PARITY_COEFFS_P2[k];
      acc ^= gfMul(shardsData[k][byteIdx], coeff);
    }
    p2[byteIdx] = acc;
  }

  const allShardArrays = [...shardsData, p1, p2];

  const shards: ErasureShard[] = allShardArrays.map((arr, idx) => ({
    shardIndex: idx,
    isParity: idx >= K,
    shardHash: bytesToHex(sha256(arr)),
    data: arr,
  }));

  return {
    originalLength,
    dataShardsCount: K,
    parityShardsCount: M,
    totalShards: K + M,
    shardSize,
    shards,
  };
}

/**
 * Reconstructs the exact original data from ANY 4 shards out of 6!
 * If 4 or more shards are present, recovery is guaranteed.
 */
export function decodeReedSolomon4plus2(
  availableShards: ErasureShard[],
  originalLength: number
): Uint8Array {
  const K = 4;
  if (availableShards.length < K) {
    throw new Error(`Insufficient shards: requires at least ${K} shards, got ${availableShards.length}`);
  }

  const shardSize = availableShards[0].data.length;
  // Map present shards by index
  const shardMap = new Map<number, Uint8Array>();
  for (const s of availableShards) {
    shardMap.set(s.shardIndex, s.data);
  }

  // Fast path: all original 4 data shards (0, 1, 2, 3) are intact
  if (shardMap.has(0) && shardMap.has(1) && shardMap.has(2) && shardMap.has(3)) {
    const result = new Uint8Array(originalLength);
    for (let i = 0; i < K; i++) {
      const shard = shardMap.get(i)!;
      const start = i * shardSize;
      const end = Math.min(originalLength, start + shardSize);
      result.set(shard.subarray(0, end - start), start);
    }
    return result;
  }

  // Linear system solver in GF(2^8) to reconstruct missing data shards
  // We pick exactly 4 available shards
  const pickedIndices = Array.from(shardMap.keys()).slice(0, K);
  pickedIndices.sort((a, b) => a - b);

  // Build 4x4 matrix A where row r corresponds to the linear combination of picked shard r
  // For data shard j (0 <= j < 4): row is [0...1...0]
  // For P1 (index 4): row is [1, 1, 1, 1]
  // For P2 (index 5): row is [1, 2, 4, 8]
  const matrix: number[][] = [];
  for (const idx of pickedIndices) {
    if (idx < 4) {
      const row = [0, 0, 0, 0];
      row[idx] = 1;
      matrix.push(row);
    } else if (idx === 4) {
      matrix.push([1, 1, 1, 1]);
    } else if (idx === 5) {
      matrix.push([...PARITY_COEFFS_P2]);
    }
  }

  // Invert 4x4 matrix in GF(2^8) via Gaussian elimination
  const invMatrix = invertGfMatrix(matrix);

  // Reconstruct all 4 original data shards byte by byte: D_j = sum(inv_j,r * Y_r)
  const reconstructedData = new Uint8Array(originalLength);
  const pickedArrays = pickedIndices.map(idx => shardMap.get(idx)!);

  for (let k = 0; k < K; k++) {
    const reconstructedShard = new Uint8Array(shardSize);
    for (let b = 0; b < shardSize; b++) {
      let acc = 0;
      for (let r = 0; r < K; r++) {
        const coeff = invMatrix[k][r];
        if (coeff !== 0) {
          acc ^= gfMul(pickedArrays[r][b], coeff);
        }
      }
      reconstructedShard[b] = acc;
    }

    const start = k * shardSize;
    const end = Math.min(originalLength, start + shardSize);
    if (start < originalLength) {
      reconstructedData.set(reconstructedShard.subarray(0, end - start), start);
    }
  }

  return reconstructedData;
}

/**
 * Inverts an N x N matrix over GF(256) using Gauss-Jordan elimination
 */
function invertGfMatrix(mat: number[][]): number[][] {
  const n = mat.length;
  // Create augmented matrix [A | I]
  const aug: number[][] = mat.map((row, r) => {
    const eye = Array(n).fill(0);
    eye[r] = 1;
    return [...row, ...eye];
  });

  for (let c = 0; c < n; c++) {
    // Find pivot
    let pivotRow = -1;
    for (let r = c; r < n; r++) {
      if (aug[r][c] !== 0) {
        pivotRow = r;
        break;
      }
    }
    if (pivotRow === -1) {
      throw new Error('Matrix is singular and cannot be inverted in GF(256)');
    }

    // Swap pivot row with current row
    if (pivotRow !== c) {
      const temp = aug[c];
      aug[c] = aug[pivotRow];
      aug[pivotRow] = temp;
    }

    // Scale pivot row so leading coefficient is 1
    const pivotVal = aug[c][c];
    const invPivot = gfInv(pivotVal);
    for (let j = 0; j < 2 * n; j++) {
      aug[c][j] = gfMul(aug[c][j], invPivot);
    }

    // Eliminate column in other rows
    for (let r = 0; r < n; r++) {
      if (r !== c) {
        const factor = aug[r][c];
        if (factor !== 0) {
          for (let j = 0; j < 2 * n; j++) {
            aug[r][j] ^= gfMul(aug[c][j], factor);
          }
        }
      }
    }
  }

  // Extract right half of augmented matrix (the inverse)
  return aug.map(row => row.slice(n));
}

/**
 * Derives a deterministic 256-bit symmetric chunk encryption key from the User's Vault Key:
 * K_chunk = SHA-256(vaultChaChaKeyHex || chunkIndex)
 */
export function deriveChunkEncryptionKey(vaultChaChaKeyHex: string, chunkIndex: number): Uint8Array {
  const cleanKey = hexToBytes(vaultChaChaKeyHex);
  const info = new TextEncoder().encode(`nexxus-chunk-v2:${chunkIndex}`);
  const combined = new Uint8Array(cleanKey.length + info.length);
  combined.set(cleanKey, 0);
  combined.set(info, cleanKey.length);
  return sha256(combined);
}

export interface EncryptedChunkPayload {
  nonceHex: string;     // 12 bytes = 24 hex
  ciphertextHex: string;
  tagHex: string;       // Poly1305 16-byte authentication tag
  combinedHex: string;  // nonce (12) + ciphertext + tag (16)
}

/**
 * Encrypts a 16KB chunk using ChaCha20-Poly1305 AEAD.
 * Donor nodes only see this ciphertext and tag; they lack the Vault Master Key.
 */
export function encryptChunkChaCha20(
  plaintext: Uint8Array,
  vaultChaChaKeyHex: string,
  chunkIndex: number
): EncryptedChunkPayload {
  const key32 = deriveChunkEncryptionKey(vaultChaChaKeyHex, chunkIndex);
  // Generate deterministic or cryptographically random 12-byte nonce
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);

  const cipher = chacha20poly1305(key32, nonce);
  const encrypted = cipher.encrypt(plaintext); // ciphertext + 16-byte Poly1305 tag

  const tag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce, 0);
  combined.set(encrypted, nonce.length);

  return {
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
    tagHex: bytesToHex(tag),
    combinedHex: bytesToHex(combined),
  };
}

/**
 * Decrypts a ChaCha20-Poly1305 AEAD chunk payload.
 * Verifies the Poly1305 integrity tag; throws an error if tampered.
 */
export function decryptChunkChaCha20(
  combinedOrCiphertext: Uint8Array,
  vaultChaChaKeyHex: string,
  chunkIndex: number,
  optionalNonce?: Uint8Array
): Uint8Array {
  const key32 = deriveChunkEncryptionKey(vaultChaChaKeyHex, chunkIndex);

  let nonce: Uint8Array;
  let ciphertextWithTag: Uint8Array;

  if (optionalNonce) {
    nonce = optionalNonce;
    ciphertextWithTag = combinedOrCiphertext;
  } else {
    // Combined format: first 12 bytes are nonce
    if (combinedOrCiphertext.length < 28) {
      throw new Error('Encrypted payload too short (must be at least 28 bytes for nonce + tag)');
    }
    nonce = combinedOrCiphertext.subarray(0, 12);
    ciphertextWithTag = combinedOrCiphertext.subarray(12);
  }

  const cipher = chacha20poly1305(key32, nonce);
  return cipher.decrypt(ciphertextWithTag);
}
