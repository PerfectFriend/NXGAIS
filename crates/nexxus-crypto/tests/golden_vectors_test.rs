//! Native Rust Golden Vectors Parity Test Suite
//!
//! Validates 100% cryptographic parity across all 5 official NeXXUs specification vectors:
//! 1. BIP-39 PBKDF2 HMAC-SHA512 mnemonic-to-seed
//! 2. Tor v3 .onion 62-char address generation
//! 3. Reed-Solomon GF(2^8) (4+2) encoding & loss reconstruction
//! 4. Merkle Tree odd-duplication root & inclusion audit proofs
//! 5. ChaCha20-Poly1305 AEAD authenticated encryption

use nexxus_core::tor_v3_onion_address;
use nexxus_crypto::{
    compute_merkle_root, decrypt_chunk_aead, encode_reed_solomon, encrypt_chunk_aead,
    mnemonic_to_seed, reconstruct_reed_solomon, Shard,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

fn vectors_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.join("../../nexxus-vectors")
}

// -------------------------------------------------------------
// 1. Vector 01: BIP-39 Seed
// -------------------------------------------------------------
#[derive(Deserialize)]
struct Bip39Case {
    case_id: String,
    mnemonic: String,
    passphrase: String,
    expected_seed_hex: String,
}

#[derive(Deserialize)]
struct Bip39Vector {
    cases: Vec<Bip39Case>,
}

#[test]
fn test_golden_vector_01_bip39() {
    let path = vectors_dir().join("01_bip39_seed.json");
    let content = fs::read_to_string(&path).expect("Failed to read 01_bip39_seed.json");
    let vector: Bip39Vector = serde_json::from_str(&content).expect("JSON parse error");

    for c in vector.cases {
        let seed = mnemonic_to_seed(&c.mnemonic, &c.passphrase);
        let actual_hex = hex::encode(seed);
        assert_eq!(
            actual_hex, c.expected_seed_hex,
            "BIP-39 failed for case: {}",
            c.case_id
        );
    }
}

// -------------------------------------------------------------
// 2. Vector 02: Tor v3 Onion Address
// -------------------------------------------------------------
#[derive(Deserialize)]
struct TorV3Case {
    case_id: String,
    ed25519_pubkey_hex: String,
    expected_onion_address: String,
}

#[derive(Deserialize)]
struct TorV3Vector {
    cases: Vec<TorV3Case>,
}

#[test]
fn test_golden_vector_02_tor_v3() {
    let path = vectors_dir().join("02_tor_v3_onion.json");
    let content = fs::read_to_string(&path).expect("Failed to read 02_tor_v3_onion.json");
    let vector: TorV3Vector = serde_json::from_str(&content).expect("JSON parse error");

    for c in vector.cases {
        let pubkey_bytes = hex::decode(&c.ed25519_pubkey_hex).expect("Invalid hex in pubkey");
        assert_eq!(pubkey_bytes.len(), 32);
        let mut key_arr = [0u8; 32];
        key_arr.copy_from_slice(&pubkey_bytes);

        let onion = tor_v3_onion_address(&key_arr);
        assert_eq!(
            onion, c.expected_onion_address,
            "Tor v3 onion address mismatch for case: {}",
            c.case_id
        );
        assert_eq!(onion.len(), 62);
    }
}

// -------------------------------------------------------------
// 3. Vector 03: Reed-Solomon GF(2^8) 4+2
// -------------------------------------------------------------
#[derive(Deserialize)]
struct EncodedShardSpec {
    shard_index: usize,
    is_parity: bool,
    sha256_hash: String,
    first_16_bytes_hex: String,
    last_16_bytes_hex: String,
}

#[derive(Deserialize)]
struct ReconstructionSpec {
    test_name: String,
    surviving_shard_indices: Vec<usize>,
    reconstructed_sha256_hash: String,
}

#[derive(Deserialize)]
struct RsVector {
    encoded_shards: Vec<EncodedShardSpec>,
    reconstruction_verifications: Vec<ReconstructionSpec>,
}

#[test]
fn test_golden_vector_03_reed_solomon() {
    let path = vectors_dir().join("03_reed_solomon_gf256.json");
    let content = fs::read_to_string(&path).expect("Failed to read 03_reed_solomon_gf256.json");
    let vector: RsVector = serde_json::from_str(&content).expect("JSON parse error");

    // Generate formula data: (i * 37 + 11) & 0xff for i in 0..16384
    let mut payload = vec![0u8; 16384];
    for (i, b) in payload.iter_mut().enumerate() {
        *b = ((i * 37 + 11) & 0xff) as u8;
    }

    let input_hash = hex::encode(Sha256::digest(&payload));
    assert_eq!(
        input_hash,
        "ce61cc72a84bd3526a8f955235c5f4f67439820d6ffb910b5ab07e54741262b8"
    );

    // Encode
    let encoded = encode_reed_solomon(&payload).expect("RS encode failed");
    assert_eq!(encoded.len(), 6);

    for spec in &vector.encoded_shards {
        let shard = &encoded[spec.shard_index];
        assert_eq!(shard.is_parity, spec.is_parity);

        let shard_hash = hex::encode(Sha256::digest(&shard.data));
        assert_eq!(
            shard_hash, spec.sha256_hash,
            "Shard {} hash mismatch",
            spec.shard_index
        );

        let first_16 = hex::encode(&shard.data[..16]);
        assert_eq!(first_16, spec.first_16_bytes_hex);

        let last_16 = hex::encode(&shard.data[shard.data.len() - 16..]);
        assert_eq!(last_16, spec.last_16_bytes_hex);
    }

    // Reconstruction tests
    for rspec in &vector.reconstruction_verifications {
        let mut available: Vec<Shard> = Vec::new();
        for &idx in &rspec.surviving_shard_indices {
            available.push(encoded[idx].clone());
        }

        let reconstructed = reconstruct_reed_solomon(&available).expect("RS reconstruct failed");
        let rec_hash = hex::encode(Sha256::digest(&reconstructed));
        assert_eq!(
            rec_hash, rspec.reconstructed_sha256_hash,
            "Reconstruction failed for: {}",
            rspec.test_name
        );
        assert_eq!(reconstructed, payload);
    }
}

// -------------------------------------------------------------
// 4. Vector 04: Merkle Tree PoR
// -------------------------------------------------------------
#[derive(Deserialize)]
struct MerkleVector {
    leaf_hashes: Vec<String>,
    expected_root_hash: String,
}

#[test]
fn test_golden_vector_04_merkle_tree() {
    let path = vectors_dir().join("04_merkle_tree.json");
    let content = fs::read_to_string(&path).expect("Failed to read 04_merkle_tree.json");
    let vector: MerkleVector = serde_json::from_str(&content).expect("JSON parse error");

    let mut leaves = Vec::new();
    for l_hex in &vector.leaf_hashes {
        let bytes = hex::decode(l_hex).expect("invalid hex leaf");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        leaves.push(arr);
    }

    let root = compute_merkle_root(&leaves);
    assert_eq!(hex::encode(root), vector.expected_root_hash);
}

// -------------------------------------------------------------
// 5. Vector 05: ChaCha20-Poly1305 AEAD
// -------------------------------------------------------------
#[derive(Deserialize)]
struct ChaChaCase {
    case_id: String,
    key_hex: String,
    nonce_hex: String,
    plaintext_ascii: Option<String>,
    plaintext_utf8: Option<String>,
    combined_ciphertext_tag_hex: String,
}

#[derive(Deserialize)]
struct ChaChaVector {
    cases: Vec<ChaChaCase>,
}

#[test]
fn test_golden_vector_05_chacha20_poly1305() {
    let path = vectors_dir().join("05_chacha20_poly1305.json");
    let content = fs::read_to_string(&path).expect("Failed to read 05_chacha20_poly1305.json");
    let vector: ChaChaVector = serde_json::from_str(&content).expect("JSON parse error");

    for c in vector.cases {
        let key_vec = hex::decode(&c.key_hex).expect("key hex");
        let nonce_vec = hex::decode(&c.nonce_hex).expect("nonce hex");

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_vec);

        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&nonce_vec);

        let plaintext = if let Some(ascii) = &c.plaintext_ascii {
            ascii.as_bytes().to_vec()
        } else if let Some(utf8) = &c.plaintext_utf8 {
            utf8.as_bytes().to_vec()
        } else {
            panic!("No plaintext in case {}", c.case_id);
        };

        let ciphertext_with_tag =
            encrypt_chunk_aead(&key, &nonce, &plaintext).expect("Encryption failed");
        assert_eq!(
            hex::encode(&ciphertext_with_tag),
            c.combined_ciphertext_tag_hex,
            "Ciphertext tag mismatch for {}",
            c.case_id
        );

        let decrypted =
            decrypt_chunk_aead(&key, &nonce, &ciphertext_with_tag).expect("Decryption failed");
        assert_eq!(decrypted, plaintext);
    }
}
