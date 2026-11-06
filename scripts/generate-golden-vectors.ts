/**
 * Generator for NeXXUs Golden Test Vectors
 * Emits canonical JSON files into nexxus-vectors/
 */
import * as fs from 'fs';
import * as path from 'path';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { deriveOnionAddress } from '../src/utils/bip39.js';
import { encodeReedSolomon4plus2, decodeReedSolomon4plus2 } from '../src/utils/erasureCoding.js';
import { buildMerkleTree, getMerkleProof, verifyMerkleProof } from '../src/utils/merkleProof.js';

const VECTORS_DIR = path.resolve('nexxus-vectors');
if (!fs.existsSync(VECTORS_DIR)) {
  fs.mkdirSync(VECTORS_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Vector 1: BIP-39 (Mnemonic to Seed)
// -------------------------------------------------------------
const bip39Vectors = {
  vector_id: "bip39_mnemonic_to_seed_v1",
  specification: "BIP-0039: 2048 rounds PBKDF2 HMAC-SHA512 with salt 'mnemonic' + passphrase",
  cases: [
    {
      case_id: "standard_test_vector_1_empty_passphrase",
      mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      passphrase: "",
      salt: "mnemonic",
      iterations: 2048,
      key_len_bytes: 64,
      expected_seed_hex: bytesToHex(
        pbkdf2(sha512, utf8ToBytes("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"), utf8ToBytes("mnemonic"), { c: 2048, dkLen: 64 })
      )
    },
    {
      case_id: "standard_test_vector_1_with_trezor_passphrase",
      mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      passphrase: "TREZOR",
      salt: "mnemonicTREZOR",
      iterations: 2048,
      key_len_bytes: 64,
      expected_seed_hex: bytesToHex(
        pbkdf2(sha512, utf8ToBytes("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"), utf8ToBytes("mnemonicTREZOR"), { c: 2048, dkLen: 64 })
      )
    },
    {
      case_id: "nexxus_sovereign_passphrase",
      mnemonic: "abandon ability able about above absent absorb abstract absurd abuse access accident",
      passphrase: "nexxus-salt",
      salt: "mnemonicnexxus-salt",
      iterations: 2048,
      key_len_bytes: 64,
      expected_seed_hex: bytesToHex(
        pbkdf2(sha512, utf8ToBytes("abandon ability able about above absent absorb abstract absurd abuse access accident"), utf8ToBytes("mnemonicnexxus-salt"), { c: 2048, dkLen: 64 })
      )
    }
  ]
};
fs.writeFileSync(path.join(VECTORS_DIR, '01_bip39_seed.json'), JSON.stringify(bip39Vectors, null, 2));
console.log('✅ Generated 01_bip39_seed.json');

// -------------------------------------------------------------
// Vector 2: Tor v3 Onion Address
// -------------------------------------------------------------
const onionCases = [
  {
    case_id: "fixed_ed25519_pubkey_1",
    ed25519_pubkey_hex: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    version_byte: 3,
    checksum_algo: "SHA-256('.onion checksum' + pubkey + 0x03)[0..2]",
    address_len_chars: 62,
    expected_onion_address: deriveOnionAddress(hexToBytes("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"))
  },
  {
    case_id: "fixed_ed25519_pubkey_2",
    ed25519_pubkey_hex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    version_byte: 3,
    checksum_algo: "SHA-256('.onion checksum' + pubkey + 0x03)[0..2]",
    address_len_chars: 62,
    expected_onion_address: deriveOnionAddress(hexToBytes("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"))
  }
];
fs.writeFileSync(path.join(VECTORS_DIR, '02_tor_v3_onion.json'), JSON.stringify({
  vector_id: "tor_v3_onion_address_v1",
  specification: "Tor v3 rendezvous spec: base32(pubkey[32] || checksum[2] || 0x03) + '.onion'",
  cases: onionCases
}, null, 2));
console.log('✅ Generated 02_tor_v3_onion.json');

// -------------------------------------------------------------
// Vector 3: Reed-Solomon (4+2) over GF(2^8)
// -------------------------------------------------------------
// Generate deterministic 16KB payload
const payload16k = new Uint8Array(16384);
for (let i = 0; i < 16384; i++) {
  payload16k[i] = (i * 37 + 11) & 0xff;
}
const payloadHash = bytesToHex(sha256(payload16k));
const rsEnc = encodeReedSolomon4plus2(payload16k);

// Test reconstruction with loss of shards [0, 1]
const survivingShards01 = rsEnc.shards.slice(2, 6); // Shards 2, 3, 4, 5
const reconstructed01 = decodeReedSolomon4plus2(survivingShards01, 16384);
const reconstructedHash01 = bytesToHex(sha256(reconstructed01));

// Test reconstruction with loss of shards [2, 4]
const survivingShards24 = [rsEnc.shards[0], rsEnc.shards[1], rsEnc.shards[3], rsEnc.shards[5]];
const reconstructed24 = decodeReedSolomon4plus2(survivingShards24, 16384);
const reconstructedHash24 = bytesToHex(sha256(reconstructed24));

const rsVector = {
  vector_id: "reed_solomon_gf256_4plus2_v1",
  specification: "Reed-Solomon over GF(2^8) with primitive polynomial 0x11D, K=4 data shards, M=2 parity shards",
  gf_primitive_polynomial: "0x11d",
  data_shards_count: 4,
  parity_shards_count: 2,
  total_shards_count: 6,
  shard_size_bytes: 4096,
  parity_1_algorithm: "XOR sum D0 ^ D1 ^ D2 ^ D3",
  parity_2_coefficients: [1, 2, 4, 8],
  input_payload: {
    length_bytes: 16384,
    generator_formula: "(i * 37 + 11) & 0xff for i in 0..16383",
    sha256_hash: payloadHash
  },
  encoded_shards: rsEnc.shards.map(s => ({
    shard_index: s.shardIndex,
    is_parity: s.isParity,
    size_bytes: s.data.length,
    sha256_hash: s.shardHash,
    first_16_bytes_hex: bytesToHex(s.data.subarray(0, 16)),
    last_16_bytes_hex: bytesToHex(s.data.subarray(s.data.length - 16))
  })),
  reconstruction_verifications: [
    {
      test_name: "Loss of Shards [0, 1] (Data shards 0 & 1 lost; Shards 2,3,4,5 survive)",
      surviving_shard_indices: [2, 3, 4, 5],
      reconstructed_sha256_hash: reconstructedHash01,
      bit_for_bit_match: reconstructedHash01 === payloadHash
    },
    {
      test_name: "Loss of Shards [2, 4] (Data shard 2 & Parity shard 4 lost; Shards 0,1,3,5 survive)",
      surviving_shard_indices: [0, 1, 3, 5],
      reconstructed_sha256_hash: reconstructedHash24,
      bit_for_bit_match: reconstructedHash24 === payloadHash
    }
  ]
};
fs.writeFileSync(path.join(VECTORS_DIR, '03_reed_solomon_gf256.json'), JSON.stringify(rsVector, null, 2));
console.log('✅ Generated 03_reed_solomon_gf256.json');

// -------------------------------------------------------------
// Vector 4: Merkle Tree & Proof-of-Retrievability
// -------------------------------------------------------------
const fixedLeaves = [
  "0000000000000000000000000000000000000000000000000000000000000001",
  "0000000000000000000000000000000000000000000000000000000000000002",
  "0000000000000000000000000000000000000000000000000000000000000003",
  "0000000000000000000000000000000000000000000000000000000000000004",
  "0000000000000000000000000000000000000000000000000000000000000005"
];
const merkleTree = buildMerkleTree(fixedLeaves);
const proofIndex2 = getMerkleProof(merkleTree.layers, 2);
const proofValid2 = verifyMerkleProof(fixedLeaves[2], proofIndex2, merkleTree.root);

const merkleVector = {
  vector_id: "merkle_tree_por_v1",
  specification: "Binary SHA-256 Merkle Tree with odd-node duplication (Bitcoin/NeXXUs convention)",
  leaf_count: fixedLeaves.length,
  leaf_hashes: fixedLeaves,
  tree_layers: merkleTree.layers,
  expected_root_hash: merkleTree.root,
  audit_proof_index_2: {
    target_leaf_index: 2,
    target_leaf_hash: fixedLeaves[2],
    sibling_hashes: proofIndex2.siblingHashes,
    is_right_sibling: proofIndex2.isRightSibling,
    verification_success: proofValid2
  }
};
fs.writeFileSync(path.join(VECTORS_DIR, '04_merkle_tree.json'), JSON.stringify(merkleVector, null, 2));
console.log('✅ Generated 04_merkle_tree.json');

// -------------------------------------------------------------
// Vector 5: ChaCha20-Poly1305 AEAD
// -------------------------------------------------------------
const rfcKey = hexToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
const rfcNonce = hexToBytes("070000004041424344454647");
const rfcPlaintext = utf8ToBytes("Ladies and Gentlemen of the class of \x2799: If I could offer you only one tip for the future, sunscreen would be it.");
const rfcCipher = chacha20poly1305(rfcKey, rfcNonce);
const rfcEncrypted = rfcCipher.encrypt(rfcPlaintext);
const rfcTag = rfcEncrypted.subarray(rfcEncrypted.length - 16);
const rfcCiphertext = rfcEncrypted.subarray(0, rfcEncrypted.length - 16);

// NeXXUs 16KB chunk test vector
const nexxusKey = hexToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
const nexxusNonce = hexToBytes("000000000000000000000001");
const nexxusPlaintext = utf8ToBytes("NeXXUs Sovereign Decentralized Storage Chunk Payload - Zero Knowledge AEAD Test");
const nexxusCipher = chacha20poly1305(nexxusKey, nexxusNonce);
const nexxusEncrypted = nexxusCipher.encrypt(nexxusPlaintext);
const nexxusTag = nexxusEncrypted.subarray(nexxusEncrypted.length - 16);
const nexxusCiphertext = nexxusEncrypted.subarray(0, nexxusEncrypted.length - 16);

const chachaVector = {
  vector_id: "chacha20_poly1305_aead_v1",
  specification: "RFC 8439 ChaCha20-Poly1305 AEAD (256-bit key, 96-bit nonce, 128-bit tag)",
  cases: [
    {
      case_id: "rfc_8439_section_2_8_2",
      key_hex: "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f",
      nonce_hex: "070000004041424344454647",
      plaintext_ascii: "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
      ciphertext_hex: bytesToHex(rfcCiphertext),
      tag_hex: bytesToHex(rfcTag),
      combined_ciphertext_tag_hex: bytesToHex(rfcEncrypted)
    },
    {
      case_id: "nexxus_chunk_aead_test",
      key_hex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      nonce_hex: "000000000000000000000001",
      plaintext_utf8: "NeXXUs Sovereign Decentralized Storage Chunk Payload - Zero Knowledge AEAD Test",
      ciphertext_hex: bytesToHex(nexxusCiphertext),
      tag_hex: bytesToHex(nexxusTag),
      combined_ciphertext_tag_hex: bytesToHex(nexxusEncrypted)
    }
  ]
};
fs.writeFileSync(path.join(VECTORS_DIR, '05_chacha20_poly1305.json'), JSON.stringify(chachaVector, null, 2));
console.log('✅ Generated 05_chacha20_poly1305.json');

console.log('🎉 All 5 Golden Vectors successfully generated in nexxus-vectors/');
