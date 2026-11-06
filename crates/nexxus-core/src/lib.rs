//! NeXXUs Protocol Core Library
//!
//! Provides fundamental data structures, identity management,
//! Tor v3 address formatting, and error types.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

pub const MAGIC_BYTES: [u8; 4] = [0x4E, 0x45, 0x58, 0x58]; // 'NEXX'
pub const PROTOCOL_VERSION: u8 = 2;
pub const CHUNK_SIZE_BYTES: usize = 16 * 1024; // 16 KB
pub const SECTION_SIZE_BYTES: u64 = 16 * 1024 * 1024 * 1024; // 16 GB
pub const RS_DATA_SHARDS: usize = 4;
pub const RS_PARITY_SHARDS: usize = 2;
pub const RS_TOTAL_SHARDS: usize = 6;
pub const SHARD_SIZE_BYTES: usize = 4096; // 16KB / 4 data shards

#[derive(Error, Debug)]
pub enum NexxusError {
    #[error("Cryptographic verification failed: {0}")]
    CryptoError(String),

    #[error("Wire frame parsing error: {0}")]
    WireError(String),

    #[error("Storage I/O failure: {0}")]
    StorageError(String),

    #[error("P2P network error: {0}")]
    NetworkError(String),

    #[error("Invalid checksum or payload corrupted")]
    ChecksumMismatch,

    #[error("Quorum failure: required {required} shards, but only {available} available")]
    QuorumFailure { required: usize, available: usize },

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, NexxusError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub id: String,
    pub name: String,
    pub onion_address: String,
    pub total_storage_gb: u32,
    pub stored_chunks_count: u64,
    pub reputation_score: u32,
    pub is_online: bool,
    pub last_ping_timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMetadata {
    pub file_id: String,
    pub chunk_index: u32,
    pub chunk_hash: String,
    pub size_bytes: u32,
    pub replication_factor: u8,
    pub timestamp: u64,
}

/// Computes SHA-256 digest returning 32-byte hash
pub fn sha256_digest(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

/// Formats a 32-byte public key into hex account address: `nx1q_<hex_prefix>`
pub fn format_account_address(pubkey: &[u8; 32]) -> String {
    format!("nx1q_{}", hex::encode(&pubkey[0..16]))
}

/// RFC 4648 lowercase base32 encoder without padding
pub fn base32_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8; 32] = b"abcdefghijklmnopqrstuvwxyz234567";
    let mut result = String::new();
    let mut buffer: u64 = 0;
    let mut bits_in_buffer = 0;

    for &byte in data {
        buffer = (buffer << 8) | (byte as u64);
        bits_in_buffer += 8;
        while bits_in_buffer >= 5 {
            bits_in_buffer -= 5;
            let index = ((buffer >> bits_in_buffer) & 0x1F) as usize;
            result.push(ALPHABET[index] as char);
        }
    }
    if bits_in_buffer > 0 {
        let index = ((buffer << (5 - bits_in_buffer)) & 0x1F) as usize;
        result.push(ALPHABET[index] as char);
    }
    result
}

/// Derives canonical 62-character Tor v3 Onion address from 32-byte Ed25519 public key
pub fn compute_tor_v3_onion_address(pubkey: &[u8; 32]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b".onion checksum");
    hasher.update(pubkey);
    hasher.update(&[0x03]);
    let digest = hasher.finalize();

    let mut raw = Vec::with_capacity(35);
    raw.extend_from_slice(pubkey);
    raw.extend_from_slice(&digest[0..2]);
    raw.push(0x03);

    format!("{}.onion", base32_encode(&raw))
}

pub use compute_tor_v3_onion_address as tor_v3_onion_address;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_magic_bytes() {
        assert_eq!(&MAGIC_BYTES, b"NEXX");
    }

    #[test]
    fn test_chunk_math() {
        assert_eq!(CHUNK_SIZE_BYTES / RS_DATA_SHARDS, SHARD_SIZE_BYTES);
    }

    #[test]
    fn test_tor_v3_golden_vector() {
        let pubkey_bytes = hex::decode("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a").unwrap();
        let mut pubkey = [0u8; 32];
        pubkey.copy_from_slice(&pubkey_bytes);

        let onion = compute_tor_v3_onion_address(&pubkey);
        assert_eq!(onion, "25njqamcweflpvkl73j4szahhihoc4xt3ktcgjnpaingr5yhkenjpzad.onion");
        assert_eq!(onion.len(), 62);
    }
}
