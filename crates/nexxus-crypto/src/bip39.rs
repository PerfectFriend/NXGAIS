//! BIP-39 PBKDF2 HMAC-SHA512 Key Derivation
//!
//! Provides deterministic mnemonic-to-seed derivation adhering to BIP-0039.

use sha2::{Digest, Sha512};

/// Computes HMAC-SHA512 for a given key and message.
pub fn hmac_sha512(key: &[u8], message: &[u8]) -> [u8; 64] {
    const BLOCK_SIZE: usize = 128;
    let mut key_block = [0u8; BLOCK_SIZE];

    if key.len() > BLOCK_SIZE {
        let mut hasher = Sha512::new();
        hasher.update(key);
        let hash = hasher.finalize();
        key_block[..64].copy_from_slice(&hash);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }

    let mut o_key_pad = [0x5cu8; BLOCK_SIZE];
    let mut i_key_pad = [0x36u8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        o_key_pad[i] ^= key_block[i];
        i_key_pad[i] ^= key_block[i];
    }

    let mut inner = Sha512::new();
    inner.update(&i_key_pad);
    inner.update(message);
    let inner_hash = inner.finalize();

    let mut outer = Sha512::new();
    outer.update(&o_key_pad);
    outer.update(&inner_hash);
    let result = outer.finalize();

    let mut out = [0u8; 64];
    out.copy_from_slice(&result);
    out
}

/// Derives a 64-byte seed from a mnemonic and passphrase using 2048 rounds of PBKDF2 HMAC-SHA512.
pub fn mnemonic_to_seed(mnemonic: &str, passphrase: &str) -> [u8; 64] {
    let password = mnemonic.as_bytes();
    let salt = format!("mnemonic{}", passphrase);
    let salt_bytes = salt.as_bytes();

    // Block index = 1 in big-endian (4 bytes: 0, 0, 0, 1)
    let mut salt_with_index = Vec::with_capacity(salt_bytes.len() + 4);
    salt_with_index.extend_from_slice(salt_bytes);
    salt_with_index.extend_from_slice(&[0, 0, 0, 1]);

    let mut u = hmac_sha512(password, &salt_with_index);
    let mut acc = u;

    // Remaining 2047 rounds
    for _ in 1..2048 {
        u = hmac_sha512(password, &u);
        for j in 0..64 {
            acc[j] ^= u[j];
        }
    }

    acc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bip39_abandon() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed = mnemonic_to_seed(mnemonic, "");
        assert_eq!(
            hex::encode(seed),
            "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4"
        );
    }
}
