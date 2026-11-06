//! NeXXUs WebAssembly (WASM) Crypto Bridge
//!
//! Phase 4.1: High-performance browser WebAssembly module exposing canonical
//! Reed-Solomon (4+2), ChaCha20-Poly1305, Merkle PoR, and Tor v3 routines to the web client.

use js_sys::{Array, Uint8Array};
use nexxus_core::{compute_tor_v3_onion_address, CHUNK_SIZE_BYTES};
use nexxus_crypto::{
    compute_merkle_root, decrypt_chunk_aead, encode_reed_solomon, encrypt_chunk_aead,
    reconstruct_reed_solomon, Shard,
};
use nexxus_storage::{ZkPorEngine, ZkPorProof};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn wasm_get_engine_info() -> JsValue {
    serde_wasm_bindgen::to_value(&serde_json::json!({
        "engine": "NeXXUs Core v2.0-rust (WASM)",
        "target": "wasm32-unknown-unknown",
        "reed_solomon": "4+2 Galois Field GF(2^8) Gauss-Jordan",
        "cipher": "ChaCha20-Poly1305 AEAD",
        "hash": "SHA-256 Merkle Tree",
        "tor": "v3 Base32 62-char Onion Addressing",
        "zk_por": "Schnorr-Pedersen Zero-Knowledge Proofs"
    })).unwrap()
}

/// Computes Tor v3 62-character .onion address from 32-byte Ed25519 public key
#[wasm_bindgen]
pub fn wasm_compute_tor_v3_onion(pubkey_bytes: &[u8]) -> Result<String, JsValue> {
    if pubkey_bytes.len() != 32 {
        return Err(JsValue::from_str("Ed25519 public key must be exactly 32 bytes"));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(pubkey_bytes);
    Ok(compute_tor_v3_onion_address(&key))
}

/// Encodes 16KB data into 6 shards (4 data, 2 parity)
#[wasm_bindgen]
pub fn wasm_reed_solomon_encode(data: &[u8]) -> Result<Array, JsValue> {
    if data.len() != CHUNK_SIZE_BYTES {
        return Err(JsValue::from_str(&format!(
            "Chunk size must be exactly {} bytes, got {}",
            CHUNK_SIZE_BYTES,
            data.len()
        )));
    }

    let shards = encode_reed_solomon(data)
        .map_err(|e| JsValue::from_str(&format!("RS encode failed: {:?}", e)))?;

    let array = Array::new();
    for shard in shards {
        let uint8 = Uint8Array::from(shard.data.as_slice());
        array.push(&uint8);
    }
    Ok(array)
}

/// Reconstructs 16KB chunk from any >= 4 available shards
#[wasm_bindgen]
pub fn wasm_reed_solomon_reconstruct(
    shard_indices: &[u8],
    shard_buffers: Array,
) -> Result<Vec<u8>, JsValue> {
    if shard_indices.len() != shard_buffers.length() as usize {
        return Err(JsValue::from_str("Indices and buffers length mismatch"));
    }

    if shard_indices.len() < 4 {
        return Err(JsValue::from_str("At least 4 shards required for reconstruction"));
    }

    let mut shards: Vec<Shard> = Vec::with_capacity(shard_indices.len());
    for (i, &idx) in shard_indices.iter().enumerate() {
        let js_val = shard_buffers.get(i as u32);
        let uint8 = Uint8Array::new(&js_val);
        let bytes = uint8.to_vec();
        shards.push(Shard {
            index: idx as usize,
            is_parity: idx >= 4,
            data: bytes,
        });
    }

    reconstruct_reed_solomon(&shards)
        .map_err(|e| JsValue::from_str(&format!("RS reconstruction failed: {:?}", e)))
}

/// ChaCha20-Poly1305 AEAD encryption
#[wasm_bindgen]
pub fn wasm_chacha20_encrypt(key: &[u8], nonce: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    if nonce.len() != 12 {
        return Err(JsValue::from_str("Nonce must be 12 bytes"));
    }
    let mut k = [0u8; 32];
    k.copy_from_slice(key);
    let mut n = [0u8; 12];
    n.copy_from_slice(nonce);

    encrypt_chunk_aead(&k, &n, plaintext)
        .map_err(|e| JsValue::from_str(&format!("Encryption failed: {:?}", e)))
}

/// ChaCha20-Poly1305 AEAD decryption
#[wasm_bindgen]
pub fn wasm_chacha20_decrypt(key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    if nonce.len() != 12 {
        return Err(JsValue::from_str("Nonce must be 12 bytes"));
    }
    let mut k = [0u8; 32];
    k.copy_from_slice(key);
    let mut n = [0u8; 12];
    n.copy_from_slice(nonce);

    decrypt_chunk_aead(&k, &n, ciphertext)
        .map_err(|e| JsValue::from_str(&format!("Decryption failed: {:?}", e)))
}

/// Computes SHA-256 Merkle root from hex leaf hashes
#[wasm_bindgen]
pub fn wasm_compute_merkle_root(leaf_hashes_hex: Vec<String>) -> Result<String, JsValue> {
    let mut leaves = Vec::with_capacity(leaf_hashes_hex.len());
    for hex_str in leaf_hashes_hex {
        let bytes = hex::decode(&hex_str)
            .map_err(|e| JsValue::from_str(&format!("Invalid hex hash: {:?}", e)))?;
        if bytes.len() != 32 {
            return Err(JsValue::from_str("Each leaf hash must be 32 bytes"));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        leaves.push(arr);
    }

    let root = compute_merkle_root(&leaves);
    Ok(hex::encode(root))
}

/// Verifies a ZK-PoR proof in WebAssembly
#[wasm_bindgen]
pub fn wasm_verify_zk_por(
    proof_json: &str,
    challenge_seed_hex: &str,
    expected_commitment: &str,
) -> bool {
    let Ok(proof) = serde_json::from_str::<ZkPorProof>(proof_json) else {
        return false;
    };
    let Ok(seed_bytes) = hex::decode(challenge_seed_hex) else {
        return false;
    };
    if seed_bytes.len() != 32 {
        return false;
    }
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&seed_bytes);

    ZkPorEngine::verify_zk_proof(&proof, &seed, expected_commitment)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_tor_v3_calculation() {
        let pubkey = [0x42u8; 32];
        let onion = wasm_compute_tor_v3_onion(&pubkey).unwrap();
        assert!(onion.ends_with(".onion"));
        assert_eq!(onion.len(), 62);
    }
}
