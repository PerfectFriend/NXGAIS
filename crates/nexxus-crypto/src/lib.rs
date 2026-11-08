//! NeXXUs Cryptographic Engine
//!
//! High-performance ChaCha20-Poly1305 AEAD, Galois Field GF(2^8) Reed-Solomon (4+2)
//! erasure coding, and Merkle tree inclusion verification for PoR audits.

use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use nexxus_core::{NexxusError, Result, CHUNK_SIZE_BYTES, RS_DATA_SHARDS, RS_TOTAL_SHARDS, SHARD_SIZE_BYTES};
use sha2::{Digest, Sha256};

pub mod bip39;
pub mod gf_simd;
pub mod pqc_kyber;
pub mod zk_snark_por;

pub use bip39::mnemonic_to_seed;
pub use gf_simd::{has_avx2_acceleration, mul_slice_add, xor_slice};
pub use pqc_kyber::{HybridEncapsulation, HybridKeyPair, PqcHybridEngine};
pub use zk_snark_por::{SnarkCircuitVerification, SnarkPorProof, ZkSnarkEngine};

// --- 1. Galois Field GF(2^8) Math (Primitive Polynomial: 0x11d) ---
const PRIM_POLY: u16 = 0x11d;

pub struct GaloisField {
    exp: [u8; 512],
    log: [u8; 256],
}

impl GaloisField {
    pub fn new() -> Self {
        let mut exp = [0u8; 512];
        let mut log = [0u8; 256];
        let mut x: u16 = 1;
        for i in 0..255 {
            exp[i] = x as u8;
            exp[i + 255] = x as u8;
            log[x as usize] = i as u8;
            x <<= 1;
            if x & 0x100 != 0 {
                x ^= PRIM_POLY;
            }
        }
        Self { exp, log }
    }

    pub fn mul(&self, a: u8, b: u8) -> u8 {
        if a == 0 || b == 0 {
            0
        } else {
            let idx = (self.log[a as usize] as usize) + (self.log[b as usize] as usize);
            self.exp[idx]
        }
    }

    pub fn div(&self, a: u8, b: u8) -> u8 {
        if b == 0 {
            panic!("Division by zero in GF(2^8)");
        }
        if a == 0 {
            0
        } else {
            let idx = (self.log[a as usize] as isize) - (self.log[b as usize] as isize) + 255;
            self.exp[(idx % 255) as usize]
        }
    }
}

lazy_static::lazy_static! {
    static ref GF: GaloisField = GaloisField::new();
}

/// Multiply two elements in GF(2^8)
pub fn gf_mul(a: u8, b: u8) -> u8 {
    GF.mul(a, b)
}

/// Divide two elements in GF(2^8)
pub fn gf_div(a: u8, b: u8) -> u8 {
    GF.div(a, b)
}

/// Multiplies two 4x4 matrices in GF(2^8)
pub fn gf_mat_mul_4x4(a: &[[u8; 4]; 4], b: &[[u8; 4]; 4]) -> [[u8; 4]; 4] {
    let mut res = [[0u8; 4]; 4];
    for r in 0..4 {
        for c in 0..4 {
            let mut sum = 0u8;
            for k in 0..4 {
                sum ^= GF.mul(a[r][k], b[k][c]);
            }
            res[r][c] = sum;
        }
    }
    res
}

/// Shard structure for Reed-Solomon (4+2)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Shard {
    pub index: usize,
    pub is_parity: bool,
    pub data: Vec<u8>,
}

/// Generator matrix rows for Reed-Solomon (4+2):
/// Rows 0..4 are identity vectors, row 4 is [1, 1, 1, 1], row 5 is [1, 2, 4, 8].
pub const RS_GENERATOR_ROWS: [[u8; 4]; 6] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 2, 4, 8],
];

/// Encodes 16KB data into 4 data shards and 2 parity shards (4096 bytes each)
pub fn encode_reed_solomon(data: &[u8]) -> Result<Vec<Shard>> {
    if data.len() != CHUNK_SIZE_BYTES {
        return Err(NexxusError::CryptoError(format!(
            "Input data must be exactly {} bytes, got {}",
            CHUNK_SIZE_BYTES,
            data.len()
        )));
    }

    let mut shards: Vec<Shard> = Vec::with_capacity(RS_TOTAL_SHARDS);

    // 4 Data shards
    for i in 0..RS_DATA_SHARDS {
        let start = i * SHARD_SIZE_BYTES;
        let end = start + SHARD_SIZE_BYTES;
        shards.push(Shard {
            index: i,
            is_parity: false,
            data: data[start..end].to_vec(),
        });
    }

    // Vectorized parity matrix rows for parity shards
    let data_refs: Vec<&[u8]> = shards.iter().map(|s| s.data.as_slice()).collect();

    // Parity 0: XOR sum of all 4 data shards [1, 1, 1, 1]
    let mut p0 = vec![0u8; SHARD_SIZE_BYTES];
    gf_simd::gf_mat_mul_shards(&GF, &data_refs, &[1, 1, 1, 1], &mut p0);

    // Parity 1: Weighted Galois Field sum (coefficients: 1, 2, 4, 8)
    let coeffs = [1u8, 2u8, 4u8, 8u8];
    let mut p1 = vec![0u8; SHARD_SIZE_BYTES];
    gf_simd::gf_mat_mul_shards(&GF, &data_refs, &coeffs, &mut p1);

    drop(data_refs);

    shards.push(Shard {
        index: 4,
        is_parity: true,
        data: p0,
    });
    shards.push(Shard {
        index: 5,
        is_parity: true,
        data: p1,
    });

    Ok(shards)
}

/// Solves a 4x4 linear system over GF(2^8) using Gauss-Jordan elimination to invert the generator submatrix.
pub fn invert_gf_matrix(mat: &[[u8; 4]; 4]) -> Result<[[u8; 4]; 4]> {
    let mut aug = [[0u8; 8]; 4];
    for r in 0..4 {
        for c in 0..4 {
            aug[r][c] = mat[r][c];
        }
        aug[r][4 + r] = 1;
    }

    for c in 0..4 {
        // Find pivot
        let mut pivot_row = None;
        for r in c..4 {
            if aug[r][c] != 0 {
                pivot_row = Some(r);
                break;
            }
        }
        let pivot_row = pivot_row.ok_or_else(|| {
            NexxusError::CryptoError("Singular GF(2^8) matrix during Reed-Solomon reconstruction".into())
        })?;

        if pivot_row != c {
            aug.swap(c, pivot_row);
        }

        let pivot_val = aug[c][c];
        let inv_pivot = GF.div(1, pivot_val);
        for col in 0..8 {
            aug[c][col] = GF.mul(aug[c][col], inv_pivot);
        }

        for r in 0..4 {
            if r != c {
                let factor = aug[r][c];
                if factor != 0 {
                    for col in 0..8 {
                        let term = GF.mul(aug[c][col], factor);
                        aug[r][col] ^= term;
                    }
                }
            }
        }
    }

    let mut inv = [[0u8; 4]; 4];
    for r in 0..4 {
        for c in 0..4 {
            inv[r][c] = aug[r][4 + c];
        }
    }
    Ok(inv)
}

/// Reconstructs original 16KB chunk from ANY >= 4 available shards out of 6
pub fn reconstruct_reed_solomon(available: &[Shard]) -> Result<Vec<u8>> {
    if available.len() < RS_DATA_SHARDS {
        return Err(NexxusError::QuorumFailure {
            required: RS_DATA_SHARDS,
            available: available.len(),
        });
    }

    // Fast path: if all 4 original data shards (0, 1, 2, 3) are present
    let has_d0 = available.iter().any(|s| s.index == 0);
    let has_d1 = available.iter().any(|s| s.index == 1);
    let has_d2 = available.iter().any(|s| s.index == 2);
    let has_d3 = available.iter().any(|s| s.index == 3);

    if has_d0 && has_d1 && has_d2 && has_d3 {
        let mut output = Vec::with_capacity(CHUNK_SIZE_BYTES);
        for d in 0..4 {
            let shard = available.iter().find(|s| s.index == d).unwrap();
            output.extend_from_slice(&shard.data);
        }
        return Ok(output);
    }

    // Pick first 4 unique available shards
    let mut picked: Vec<&Shard> = Vec::with_capacity(4);
    for shard in available {
        if !picked.iter().any(|s| s.index == shard.index) {
            picked.push(shard);
            if picked.len() == 4 {
                break;
            }
        }
    }
    picked.sort_by_key(|s| s.index);

    // Build 4x4 matrix A where row r corresponds to the picked shard's generator row
    let coeffs_p1 = [1u8, 2u8, 4u8, 8u8];
    let mut mat = [[0u8; 4]; 4];
    for (r, shard) in picked.iter().enumerate() {
        if shard.index < 4 {
            mat[r][shard.index] = 1;
        } else if shard.index == 4 {
            mat[r] = [1, 1, 1, 1];
        } else if shard.index == 5 {
            mat[r] = coeffs_p1;
        }
    }

    // Invert the 4x4 matrix over GF(2^8)
    let inv_mat = invert_gf_matrix(&mat)?;

    // Vectorized reconstruction of all 4 data shards
    let picked_refs: Vec<&[u8]> = picked.iter().map(|s| s.data.as_slice()).collect();
    let mut output = Vec::with_capacity(CHUNK_SIZE_BYTES);
    for k in 0..RS_DATA_SHARDS {
        let mut shard_bytes = vec![0u8; SHARD_SIZE_BYTES];
        gf_simd::gf_mat_mul_shards(&GF, &picked_refs, &inv_mat[k], &mut shard_bytes);
        output.extend_from_slice(&shard_bytes);
    }

    Ok(output)
}

// --- 2. ChaCha20-Poly1305 AEAD Encryption ---

pub fn encrypt_chunk_aead(key: &[u8; 32], nonce: &[u8; 12], plaintext: &[u8]) -> Result<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce_ref = Nonce::from_slice(nonce);
    cipher
        .encrypt(nonce_ref, plaintext)
        .map_err(|e| NexxusError::CryptoError(format!("ChaCha20-Poly1305 encryption failed: {:?}", e)))
}

pub fn decrypt_chunk_aead(key: &[u8; 32], nonce: &[u8; 12], ciphertext: &[u8]) -> Result<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce_ref = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce_ref, ciphertext)
        .map_err(|e| NexxusError::CryptoError(format!("ChaCha20-Poly1305 decryption failed: {:?}", e)))
}

// --- 3. Merkle Tree Root Computation for Proof-of-Retrievability ---

pub fn compute_merkle_root(leaf_hashes: &[[u8; 32]]) -> [u8; 32] {
    if leaf_hashes.is_empty() {
        return [0u8; 32];
    }
    if leaf_hashes.len() == 1 {
        return leaf_hashes[0];
    }

    let mut current_level = leaf_hashes.to_vec();
    while current_level.len() > 1 {
        let mut next_level = Vec::with_capacity((current_level.len() + 1) / 2);
        for chunk in current_level.chunks(2) {
            let mut hasher = Sha256::new();
            if chunk.len() == 2 {
                hasher.update(&chunk[0]);
                hasher.update(&chunk[1]);
            } else {
                hasher.update(&chunk[0]);
                hasher.update(&chunk[0]); // Duplicate odd element (Bitcoin style)
            }
            let res = hasher.finalize();
            let mut h = [0u8; 32];
            h.copy_from_slice(&res);
            next_level.push(h);
        }
        current_level = next_level;
    }
    current_level[0]
}
