/**
 * NeXXUs Protocol Golden Vectors Verification Suite
 * 
 * Verifies that the implementation strictly and byte-for-byte passes
 * all canonical test vectors in nexxus-vectors/*.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512, sha256 } from '@noble/hashes/sha2.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { deriveOnionAddress } from '../src/utils/bip39.js';
import { encodeReedSolomon4plus2, decodeReedSolomon4plus2 } from '../src/utils/erasureCoding.js';
import { buildMerkleTree, getMerkleProof, verifyMerkleProof } from '../src/utils/merkleProof.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

const VECTORS_DIR = path.resolve('nexxus-vectors');

console.log('\n================================================================');
console.log('⚡ Running NeXXUs Protocol Golden Vectors Verification Suite');
console.log('================================================================\n');

// -------------------------------------------------------------
// Vector 1: BIP-39
// -------------------------------------------------------------
console.log('📦 Vector 1: BIP-39 Mnemonic to Seed (nexxus-vectors/01_bip39_seed.json)');
const v1 = JSON.parse(fs.readFileSync(path.join(VECTORS_DIR, '01_bip39_seed.json'), 'utf-8'));
for (const tc of v1.cases) {
  const salt = utf8ToBytes(`mnemonic${tc.passphrase}`);
  const phrase = utf8ToBytes(tc.mnemonic);
  const derivedSeed = pbkdf2(sha512, phrase, salt, { c: tc.iterations, dkLen: tc.key_len_bytes });
  const derivedHex = bytesToHex(derivedSeed);
  assert(derivedHex === tc.expected_seed_hex, `BIP-39 Case '${tc.case_id}' produces exact 128-char hex seed`);
}

// -------------------------------------------------------------
// Vector 2: Tor v3 Onion Address
// -------------------------------------------------------------
console.log('\n📦 Vector 2: Tor v3 Onion Address (nexxus-vectors/02_tor_v3_onion.json)');
const v2 = JSON.parse(fs.readFileSync(path.join(VECTORS_DIR, '02_tor_v3_onion.json'), 'utf-8'));
for (const tc of v2.cases) {
  const pubkey = hexToBytes(tc.ed25519_pubkey_hex);
  const derivedAddress = deriveOnionAddress(pubkey);
  assert(derivedAddress === tc.expected_onion_address, `Tor v3 Case '${tc.case_id}' matches exact .onion address`);
  assert(derivedAddress.length === tc.address_len_chars, `Tor v3 Address length is strictly ${tc.address_len_chars} characters`);
}

// -------------------------------------------------------------
// Vector 3: Reed-Solomon (4+2) GF(2^8)
// -------------------------------------------------------------
console.log('\n📦 Vector 3: Reed-Solomon (4+2) GF(2^8) (nexxus-vectors/03_reed_solomon_gf256.json)');
const v3 = JSON.parse(fs.readFileSync(path.join(VECTORS_DIR, '03_reed_solomon_gf256.json'), 'utf-8'));
const payload = new Uint8Array(v3.input_payload.length_bytes);
for (let i = 0; i < payload.length; i++) {
  payload[i] = (i * 37 + 11) & 0xff;
}
assert(bytesToHex(sha256(payload)) === v3.input_payload.sha256_hash, 'Input payload SHA-256 hash matches vector');

const encoded = encodeReedSolomon4plus2(payload);
assert(encoded.shards.length === v3.total_shards_count, 'Produces exactly 6 shards (4 data + 2 parity)');

for (let i = 0; i < encoded.shards.length; i++) {
  const shard = encoded.shards[i];
  const expectedShard = v3.encoded_shards[i];
  assert(shard.shardHash === expectedShard.sha256_hash, `Shard #${i} (parity=${shard.isParity}) hash matches vector`);
  assert(bytesToHex(shard.data.subarray(0, 16)) === expectedShard.first_16_bytes_hex, `Shard #${i} leading 16 bytes match vector`);
}

for (const rv of v3.reconstruction_verifications) {
  const surviving = encoded.shards.filter(s => rv.surviving_shard_indices.includes(s.shardIndex));
  const restored = decodeReedSolomon4plus2(surviving, 16384);
  const restoredHash = bytesToHex(sha256(restored));
  assert(restoredHash === rv.reconstructed_sha256_hash, `Reconstruction '${rv.test_name}' produces exact original payload hash`);
}

// -------------------------------------------------------------
// Vector 4: Merkle Tree & PoR
// -------------------------------------------------------------
console.log('\n📦 Vector 4: Merkle Tree & PoR (nexxus-vectors/04_merkle_tree.json)');
const v4 = JSON.parse(fs.readFileSync(path.join(VECTORS_DIR, '04_merkle_tree.json'), 'utf-8'));
const tree = buildMerkleTree(v4.leaf_hashes);
assert(tree.root === v4.expected_root_hash, 'Merkle root hash matches golden vector root');

const proof2 = getMerkleProof(tree.layers, v4.audit_proof_index_2.target_leaf_index);
const proofVerified = verifyMerkleProof(v4.audit_proof_index_2.target_leaf_hash, proof2, tree.root);
assert(proofVerified === true, 'Merkle inclusion proof for leaf index 2 verifies against root');

// -------------------------------------------------------------
// Vector 5: ChaCha20-Poly1305 AEAD
// -------------------------------------------------------------
console.log('\n📦 Vector 5: ChaCha20-Poly1305 AEAD (nexxus-vectors/05_chacha20_poly1305.json)');
const v5 = JSON.parse(fs.readFileSync(path.join(VECTORS_DIR, '05_chacha20_poly1305.json'), 'utf-8'));
for (const tc of v5.cases) {
  const key = hexToBytes(tc.key_hex);
  const nonce = hexToBytes(tc.nonce_hex);
  const plaintext = utf8ToBytes(tc.plaintext_ascii || tc.plaintext_utf8);

  const cipher = chacha20poly1305(key, nonce);
  const encrypted = cipher.encrypt(plaintext);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const tag = encrypted.subarray(encrypted.length - 16);

  assert(bytesToHex(ciphertext) === tc.ciphertext_hex, `AEAD Case '${tc.case_id}' ciphertext matches golden vector`);
  assert(bytesToHex(tag) === tc.tag_hex, `AEAD Case '${tc.case_id}' Poly1305 tag matches golden vector`);
  assert(bytesToHex(encrypted) === tc.combined_ciphertext_tag_hex, `AEAD Case '${tc.case_id}' combined payload matches golden vector`);

  // Verify decryption
  const decrypted = cipher.decrypt(encrypted);
  assert(bytesToHex(decrypted) === bytesToHex(plaintext), `AEAD Case '${tc.case_id}' decrypts bit-for-bit to original plaintext`);
}

console.log('\n================================================================');
console.log('🎉 Golden Vectors Verification Complete: ALL TESTS PASSED!');
console.log('================================================================\n');

process.exit(0);
