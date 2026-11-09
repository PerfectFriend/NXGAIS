//! NeXXUs Node Identity Passport (Ed25519)
//! Audit ID: SEC-IDENTITY-01
//!
//! Provides a cryptographically secure, persistent identity passport for NeXXUs nodes.
//! Manages Ed25519 keypairs, deterministic Tor v3 onion address derivation,
//! and automated persistence into `node_identity.json`.

use ed25519_dalek::{SigningKey, VerifyingKey};
use nexxus_core::{tor_v3_onion_address, NexxusError, Result};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeIdentity {
    pub node_id: String,
    pub verifying_key_hex: String,
    pub signing_key_hex: String,
    pub onion_address: String,
    pub created_at_unix: u64,
}

impl NodeIdentity {
    /// Generates a fresh random Ed25519 keypair and derives the node identity
    pub fn generate() -> Self {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        Self::from_signing_key(signing_key)
    }

    /// Derives identity from an existing SigningKey
    pub fn from_signing_key(signing_key: SigningKey) -> Self {
        let verifying_key = signing_key.verifying_key();
        let vk_bytes = verifying_key.to_bytes();
        let onion = tor_v3_onion_address(&vk_bytes);
        let node_id = format!("nx_node_{}", &hex::encode(&vk_bytes)[0..16]);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            node_id,
            verifying_key_hex: hex::encode(vk_bytes),
            signing_key_hex: hex::encode(signing_key.to_bytes()),
            onion_address: onion,
            created_at_unix: now,
        }
    }

    /// Retrieves the concrete Ed25519 SigningKey
    pub fn get_signing_key(&self) -> Result<SigningKey> {
        let bytes = hex::decode(&self.signing_key_hex)
            .map_err(|e| NexxusError::CryptoError(format!("Invalid signing key hex: {:?}", e)))?;
        if bytes.len() != 32 {
            return Err(NexxusError::CryptoError("Invalid signing key length".into()));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(SigningKey::from_bytes(&arr))
    }

    /// Retrieves the concrete Ed25519 VerifyingKey
    pub fn get_verifying_key(&self) -> Result<VerifyingKey> {
        let bytes = hex::decode(&self.verifying_key_hex)
            .map_err(|e| NexxusError::CryptoError(format!("Invalid verifying key hex: {:?}", e)))?;
        if bytes.len() != 32 {
            return Err(NexxusError::CryptoError("Invalid verifying key length".into()));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        VerifyingKey::from_bytes(&arr)
            .map_err(|e| NexxusError::CryptoError(format!("Invalid verifying key bytes: {:?}", e)))
    }

    /// Loads identity passport from disk if present, otherwise generates and saves it
    pub fn load_or_create(path: impl AsRef<Path>) -> Result<Self> {
        let p = path.as_ref();
        if p.exists() {
            let data = std::fs::read(p)
                .map_err(|e| NexxusError::StorageError(format!("Failed to read node identity: {:?}", e)))?;
            let id: Self = serde_json::from_slice(&data)
                .map_err(|e| NexxusError::StorageError(format!("Failed to parse node identity: {:?}", e)))?;
            Ok(id)
        } else {
            let id = Self::generate();
            let json = serde_json::to_vec_pretty(&id)
                .map_err(|e| NexxusError::StorageError(format!("Failed to serialize identity: {:?}", e)))?;
            if let Some(parent) = p.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(p, json)
                .map_err(|e| NexxusError::StorageError(format!("Failed to save node identity: {:?}", e)))?;
            Ok(id)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_identity_lifecycle() {
        let id = NodeIdentity::generate();
        assert!(id.node_id.starts_with("nx_node_"));
        assert!(id.onion_address.ends_with(".onion"));
        assert_eq!(id.onion_address.len(), 62);

        let sk = id.get_signing_key().unwrap();
        let vk = id.get_verifying_key().unwrap();
        assert_eq!(sk.verifying_key(), vk);

        let tmp = std::env::temp_dir().join(format!("id_test_{}.json", std::process::id()));
        let saved = NodeIdentity::load_or_create(&tmp).unwrap();
        let loaded = NodeIdentity::load_or_create(&tmp).unwrap();
        assert_eq!(saved.node_id, loaded.node_id);
        assert_eq!(saved.onion_address, loaded.onion_address);
        assert_eq!(saved.verifying_key_hex, loaded.verifying_key_hex);

        let _ = std::fs::remove_file(&tmp);
    }
}
