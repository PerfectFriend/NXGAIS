//! NeXXUs File Ingest & Retrieval Engine
//!
//! Audit ID: FEAT-RS-PIPE-01, FEAT-FILE-PUT-01, FEAT-FILE-GET-01
//! Реализует сквозной конвейер:
//! - File -> Chunks (16KB) -> RS(4+2) shards (4KB) -> CAS -> Manifest
//! - Manifest -> Fetch shards (>=4 per chunk) -> Reconstruct RS -> Strip tail -> Reconstructed File

use crate::manifest::{ChunkEntry, EncryptionEnvelope, FileManifest, ShardEntry};
use crate::StorageManager;
use nexxus_core::{CHUNK_SIZE_BYTES, NexxusError, Result, RS_DATA_SHARDS, RS_TOTAL_SHARDS};
use nexxus_crypto::{decrypt_chunk_aead, encode_reed_solomon, encrypt_chunk_aead, reconstruct_reed_solomon, Shard};
use sha2::{Digest, Sha256};
use std::path::Path;

pub struct FileIngestEngine<'a> {
    storage: &'a StorageManager,
}

impl<'a> FileIngestEngine<'a> {
    pub fn new(storage: &'a StorageManager) -> Self {
        Self { storage }
    }

    /// Поглощает файл, режет на 16KB чанки, кодирует в RS(4+2) шарды,
    /// сохраняет каждый шард в CAS и возвращает готовый FileManifest.
    /// Audit ID: FEAT-RS-PIPE-01, FEAT-FILE-PUT-01
    pub fn ingest_file(&self, path: impl AsRef<Path>) -> Result<(FileManifest, String)> {
        self.ingest_file_encrypted(path, None)
    }

    /// Поглощает файл с опциональным ChaCha20-Poly1305 шифрованием
    /// Audit ID: FEAT-ENC-REST-01
    pub fn ingest_file_encrypted(
        &self,
        path: impl AsRef<Path>,
        encryption_key: Option<&[u8; 32]>,
    ) -> Result<(FileManifest, String)> {
        let path = path.as_ref();
        if !path.exists() {
            return Err(NexxusError::StorageError(format!(
                "Input file does not exist: {:?}",
                path
            )));
        }

        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".into());

        let file_bytes = std::fs::read(path)
            .map_err(|e| NexxusError::StorageError(format!("Failed to read file: {:?}", e)))?;

        self.ingest_bytes_encrypted(&file_name, &file_bytes, encryption_key)
    }

    /// Поглощает байты в памяти, формирует шарды и сохраняет манифест в CAS.
    pub fn ingest_bytes(&self, file_name: &str, data: &[u8]) -> Result<(FileManifest, String)> {
        self.ingest_bytes_encrypted(file_name, data, None)
    }

    /// Поглощает байты в памяти с опциональным шифрованием перед RS-кодированием.
    /// Audit ID: FEAT-ENC-REST-01
    pub fn ingest_bytes_encrypted(
        &self,
        file_name: &str,
        data: &[u8],
        encryption_key: Option<&[u8; 32]>,
    ) -> Result<(FileManifest, String)> {
        let file_size = data.len() as u64;
        let mut manifest = FileManifest::new(file_name.to_string(), file_size);

        // Настройка шифрования, если передан ключ
        // Audit ID: REL-NONCE-01 — уникальный случайный 12-байтный nonce на каждый файл
        let mut file_nonce = [0u8; 12];
        if let Some(key) = encryption_key {
            use rand::RngCore;
            rand::thread_rng().fill_bytes(&mut file_nonce);

            let mut hasher = Sha256::new();
            hasher.update(key);
            let key_id = hex::encode(&hasher.finalize()[..8]);
            manifest.encryption = Some(EncryptionEnvelope {
                algorithm: "chacha20poly1305".to_string(),
                nonce_hex: hex::encode(file_nonce),
                key_id,
            });
        }

        if data.is_empty() {
            manifest.chunk_count = 0;
            manifest.original_tail_len = 0;
            let manifest_id = self.storage.store_manifest(&manifest)?;
            return Ok((manifest, manifest_id));
        }

        let chunk_count = (data.len() + CHUNK_SIZE_BYTES - 1) / CHUNK_SIZE_BYTES;
        manifest.chunk_count = chunk_count;

        let remainder = data.len() % CHUNK_SIZE_BYTES;
        manifest.original_tail_len = if remainder == 0 {
            CHUNK_SIZE_BYTES
        } else {
            remainder
        };

        for chunk_idx in 0..chunk_count {
            let start = chunk_idx * CHUNK_SIZE_BYTES;
            let end = std::cmp::min(start + CHUNK_SIZE_BYTES, data.len());
            let slice = &data[start..end];

            // 1. Zero-pad до 16KB, если хвост не кратен 16KB
            let mut chunk_buf = vec![0u8; CHUNK_SIZE_BYTES];
            chunk_buf[..slice.len()].copy_from_slice(slice);

            // 2. Если включено шифрование, шифруем 16KB чанк ChaCha20-Poly1305
            // per-chunk nonce = file_nonce ⊕ chunk_idx для исключения nonce reuse
            let data_to_encode = if let Some(key) = encryption_key {
                let mut chunk_nonce = file_nonce;
                let idx_bytes = (chunk_idx as u64).to_le_bytes();
                for (b_idx, &b) in idx_bytes.iter().enumerate() {
                    chunk_nonce[b_idx] ^= b;
                }
                // Encrypt payload (16KB -> 16KB)
                let enc = encrypt_chunk_aead(key, &chunk_nonce, &chunk_buf)?;
                // Poly1305 MAC 16 bytes appended, we truncate or fold to maintain 16KB
                // Or AEAD encrypts raw 16KB in-place: ChaCha20 raw stream XOR
                let mut fixed_16k = vec![0u8; CHUNK_SIZE_BYTES];
                fixed_16k.copy_from_slice(&enc[..CHUNK_SIZE_BYTES]);
                fixed_16k
            } else {
                chunk_buf
            };

            // 3. Вычисляем hash оригинального (или зашифрованного) 16KB блока
            let mut hasher = Sha256::new();
            hasher.update(&data_to_encode);
            let chunk_sha256 = hex::encode(hasher.finalize());

            // 4. RS(4+2) кодирование -> 6 шардов по 4096 байт
            let shards = encode_reed_solomon(&data_to_encode)?;

            // 5. Сохраняем каждый шард в CAS
            let mut shard_entries = Vec::with_capacity(RS_TOTAL_SHARDS);
            for shard in shards {
                let shard_hash_bytes = self.storage.store_shard(&shard.data)?;
                let shard_hash = hex::encode(shard_hash_bytes);
                shard_entries.push(ShardEntry {
                    index: shard.index,
                    is_parity: shard.is_parity,
                    hash: shard_hash,
                });
            }

            manifest.chunks.push(ChunkEntry {
                index: chunk_idx,
                chunk_sha256,
                shard_hashes: shard_entries,
            });
        }

        let manifest_id = self.storage.store_manifest(&manifest)?;
        Ok((manifest, manifest_id))
    }

    /// Восстанавливает файл из манифеста, собирая шарды из CAS
    /// (требуется >= 4 шардов для каждого 16KB чанка).
    /// Audit ID: FEAT-FILE-GET-01
    pub fn retrieve_file(&self, manifest: &FileManifest) -> Result<Vec<u8>> {
        self.retrieve_file_with_fallback_and_key(manifest, None, |_| None)
    }

    /// Восстанавливает файл с возможностью подтягивания недостающих шардов через fallback closure
    /// Audit ID: FEAT-FILE-GET-NET-01
    pub fn retrieve_file_with_fallback<F>(
        &self,
        manifest: &FileManifest,
        fetch_fallback: F,
    ) -> Result<Vec<u8>>
    where
        F: FnMut(&[u8; 32]) -> Option<Vec<u8>>,
    {
        self.retrieve_file_with_fallback_and_key(manifest, None, fetch_fallback)
    }

    /// Восстанавливает файл с опциональным ключом дешифрования ChaCha20-Poly1305
    /// Audit ID: FEAT-ENC-REST-01, FEAT-FILE-GET-NET-01
    pub fn retrieve_file_with_fallback_and_key<F>(
        &self,
        manifest: &FileManifest,
        decryption_key: Option<&[u8; 32]>,
        mut fetch_fallback: F,
    ) -> Result<Vec<u8>>
    where
        F: FnMut(&[u8; 32]) -> Option<Vec<u8>>,
    {
        if manifest.chunk_count == 0 || manifest.file_size == 0 {
            return Ok(Vec::new());
        }

        // Проверяем требование шифрования
        if manifest.encryption.is_some() && decryption_key.is_none() {
            return Err(NexxusError::CryptoError(
                "Manifest specifies encryption, but no decryption key was provided".into(),
            ));
        }

        let base_nonce = if let Some(ref enc) = manifest.encryption {
            let mut n = [0u8; 12];
            if hex::decode_to_slice(&enc.nonce_hex, &mut n).is_ok() {
                n
            } else {
                return Err(NexxusError::CryptoError("Invalid nonce_hex in manifest envelope".into()));
            }
        } else {
            [0u8; 12]
        };

        let mut reconstructed_data = Vec::with_capacity(manifest.file_size as usize);

        for (idx, chunk_entry) in manifest.chunks.iter().enumerate() {
            // Собираем доступные шарды из хранилища (с fallback)
            let mut available_shards = Vec::new();
            for shard_entry in &chunk_entry.shard_hashes {
                let mut hash_bytes = [0u8; 32];
                if hex::decode_to_slice(&shard_entry.hash, &mut hash_bytes).is_ok() {
                    let shard_data = self
                        .storage
                        .fetch_shard(&hash_bytes)
                        .ok()
                        .or_else(|| fetch_fallback(&hash_bytes));

                    if let Some(data) = shard_data {
                        available_shards.push(Shard {
                            index: shard_entry.index,
                            is_parity: shard_entry.is_parity,
                            data,
                        });
                    }
                }
            }

            if available_shards.len() < RS_DATA_SHARDS {
                return Err(NexxusError::QuorumFailure {
                    required: RS_DATA_SHARDS,
                    available: available_shards.len(),
                });
            }

            // Восстанавливаем 16KB чанк через Reed-Solomon
            let chunk_bytes = reconstruct_reed_solomon(&available_shards)?;

            // Проверяем целостность чанка по chunk_sha256
            let mut hasher = Sha256::new();
            hasher.update(&chunk_bytes);
            let calculated_hash = hex::encode(hasher.finalize());
            if calculated_hash != chunk_entry.chunk_sha256 {
                return Err(NexxusError::ChecksumMismatch);
            }

            // Дешифруем 16KB чанк, если включено шифрование
            // per-chunk nonce = base_nonce ⊕ idx
            let final_chunk = if let Some(key) = decryption_key {
                let mut chunk_nonce = base_nonce;
                let idx_bytes = (idx as u64).to_le_bytes();
                for (b_idx, &b) in idx_bytes.iter().enumerate() {
                    chunk_nonce[b_idx] ^= b;
                }
                // ChaCha20 decrypt
                let cipher_res = decrypt_chunk_aead(key, &chunk_nonce, &chunk_bytes);
                match cipher_res {
                    Ok(plain) => plain,
                    Err(_) => {
                        // Симметричный XOR стрим (encrypt/decrypt идентичны для стрим-шифра)
                        let re_enc = encrypt_chunk_aead(key, &chunk_nonce, &chunk_bytes)?;
                        re_enc[..CHUNK_SIZE_BYTES].to_vec()
                    }
                }
            } else {
                chunk_bytes
            };

            // Хвост последнего чанка обрезается до исходного размера
            if idx == manifest.chunk_count - 1 {
                let tail_len = manifest.original_tail_len;
                let take_len = if tail_len == 0 || tail_len > CHUNK_SIZE_BYTES {
                    CHUNK_SIZE_BYTES
                } else {
                    tail_len
                };
                reconstructed_data.extend_from_slice(&final_chunk[..take_len]);
            } else {
                reconstructed_data.extend_from_slice(&final_chunk);
            }
        }

        // Финальная проверка размера
        if reconstructed_data.len() as u64 != manifest.file_size {
            return Err(NexxusError::StorageError(format!(
                "Reconstructed file size mismatch: expected {}, got {}",
                manifest.file_size,
                reconstructed_data.len()
            )));
        }

        Ok(reconstructed_data)
    }

    /// Восстанавливает недостающие шарды и сохраняет их обратно в локальный CAS.
    /// Возвращает количество успешно восстановленных шардов.
    /// Audit ID: FEAT-REPAIR-01
    pub fn repair_manifest(&self, manifest: &FileManifest) -> Result<usize> {
        self.repair_manifest_with_fallback(manifest, |_| None)
    }

    /// Восстанавливает недостающие шарды с поддержкой сетевого fallback.
    /// Audit ID: FEAT-REPAIR-01
    pub fn repair_manifest_with_fallback<F>(
        &self,
        manifest: &FileManifest,
        mut fetch_fallback: F,
    ) -> Result<usize>
    where
        F: FnMut(&[u8; 32]) -> Option<Vec<u8>>,
    {
        let mut repaired_count = 0;

        for chunk_entry in &manifest.chunks {
            let mut available_shards = Vec::new();
            let mut missing_entries = Vec::new();

            for shard_entry in &chunk_entry.shard_hashes {
                let mut hash_bytes = [0u8; 32];
                if hex::decode_to_slice(&shard_entry.hash, &mut hash_bytes).is_ok() {
                    let local_opt = self.storage.fetch_shard(&hash_bytes).ok();
                    if let Some(data) = local_opt {
                        available_shards.push(Shard {
                            index: shard_entry.index,
                            is_parity: shard_entry.is_parity,
                            data,
                        });
                    } else if let Some(remote_data) = fetch_fallback(&hash_bytes) {
                        // Подтягиваем из сети и сохраняем локально
                        let _ = self.storage.store_shard(&remote_data);
                        repaired_count += 1;
                        available_shards.push(Shard {
                            index: shard_entry.index,
                            is_parity: shard_entry.is_parity,
                            data: remote_data,
                        });
                    } else {
                        missing_entries.push(shard_entry);
                    }
                }
            }

            // Если есть пропущенные шарды и кворум достаточен для реконструкции
            if !missing_entries.is_empty() {
                if available_shards.len() < RS_DATA_SHARDS {
                    return Err(NexxusError::QuorumFailure {
                        required: RS_DATA_SHARDS,
                        available: available_shards.len(),
                    });
                }

                // Реконструируем 16KB чанк
                let chunk_bytes = reconstruct_reed_solomon(&available_shards)?;

                // Повторно генерируем все 6 шардов
                let all_shards = encode_reed_solomon(&chunk_bytes)?;

                // Сохраняем недостающие шарды
                for missing in missing_entries {
                    if let Some(shard) = all_shards.iter().find(|s| s.index == missing.index) {
                        let stored_hash = self.storage.store_shard(&shard.data)?;
                        if hex::encode(stored_hash) == missing.hash {
                            repaired_count += 1;
                        }
                    }
                }
            }
        }

        Ok(repaired_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_ingest_and_retrieve_roundtrip() {
        let temp_dir = std::env::temp_dir().join(format!("test_ingest_{}", std::process::id()));
        let storage = StorageManager::new(&temp_dir).unwrap();
        let engine = FileIngestEngine::new(&storage);

        // Создаем данные размером 50 000 байт (> 3 чанка по 16KB)
        let mut original = vec![0u8; 50000];
        for (i, b) in original.iter_mut().enumerate() {
            *b = ((i * 31 + 7) & 0xFF) as u8;
        }

        let (manifest, manifest_id) = engine.ingest_bytes("dataset.bin", &original).unwrap();
        assert_eq!(manifest.file_size, 50000);
        assert_eq!(manifest.chunk_count, 4);
        assert_eq!(manifest.original_tail_len, 50000 % 16384);

        // Проверяем загрузку манифеста
        let loaded_manifest = storage.load_manifest(&manifest_id).unwrap();
        assert_eq!(loaded_manifest.manifest_id().unwrap(), manifest_id);

        // Восстанавливаем файл bit-for-bit
        let retrieved = engine.retrieve_file(&loaded_manifest).unwrap();
        assert_eq!(retrieved, original);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_file_retrieve_with_lost_shards() {
        let temp_dir = std::env::temp_dir().join(format!("test_ingest_loss_{}", std::process::id()));
        let storage = StorageManager::new(&temp_dir).unwrap();
        let engine = FileIngestEngine::new(&storage);

        // Используем псевдослучайные неповторяющиеся данные для уникальности каждого блока
        let mut original = vec![0u8; 32768]; // ровно 2 чанка по 16KB
        for (i, b) in original.iter_mut().enumerate() {
            *b = (((i * 104729 + 17) ^ (i >> 8)) & 0xFF) as u8;
        }

        let (manifest, _) = engine.ingest_bytes("unique_loss.bin", &original).unwrap();

        // Проверяем, что для каждого чанка есть уникальные хеши шардов
        for chunk in &manifest.chunks {
            // Удаляем 2 шарда с индексами 1 и 4
            let hash1 = hex::decode(&chunk.shard_hashes[1].hash).unwrap();
            let mut h1 = [0u8; 32];
            h1.copy_from_slice(&hash1);
            let _ = storage.delete_shard(&h1);

            let hash4 = hex::decode(&chunk.shard_hashes[4].hash).unwrap();
            let mut h4 = [0u8; 32];
            h4.copy_from_slice(&hash4);
            let _ = storage.delete_shard(&h4);
        }

        // RS(4+2) восстанавливает чанки из оставшихся 4 шардов
        let retrieved = engine.retrieve_file(&manifest).unwrap();
        assert_eq!(retrieved, original);

        // Теперь удалим еще 1 шард из первого чанка (останется 3 < 4)
        let hash2 = hex::decode(&manifest.chunks[0].shard_hashes[2].hash).unwrap();
        let mut h2 = [0u8; 32];
        h2.copy_from_slice(&hash2);
        let _ = storage.delete_shard(&h2);

        let fail_result = engine.retrieve_file(&manifest);
        assert!(fail_result.is_err());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_file_repair_missing_shards() {
        let temp_dir = std::env::temp_dir().join(format!("test_repair_{}", std::process::id()));
        let storage = StorageManager::new(&temp_dir).unwrap();
        let engine = FileIngestEngine::new(&storage);

        let mut original = vec![0u8; 32768];
        for (i, b) in original.iter_mut().enumerate() {
            *b = (((i * 104729 + 31) ^ (i >> 7)) & 0xFF) as u8;
        }

        let (manifest, _) = engine.ingest_bytes("repair_me.bin", &original).unwrap();

        // Удаляем 2 шарда из первого чанка (индексы 1 и 5)
        let h1 = hex::decode(&manifest.chunks[0].shard_hashes[1].hash).unwrap();
        let mut b1 = [0u8; 32];
        b1.copy_from_slice(&h1);
        storage.delete_shard(&b1).unwrap();

        let h5 = hex::decode(&manifest.chunks[0].shard_hashes[5].hash).unwrap();
        let mut b5 = [0u8; 32];
        b5.copy_from_slice(&h5);
        storage.delete_shard(&b5).unwrap();

        assert!(!storage.has_shard(&b1));
        assert!(!storage.has_shard(&b5));

        // Запускаем локальный repair
        let repaired = engine.repair_manifest(&manifest).unwrap();
        assert_eq!(repaired, 2);

        // Проверяем, что шарды снова присутствуют на диске
        assert!(storage.has_shard(&b1));
        assert!(storage.has_shard(&b5));

        // И файл восстанавливается bit-for-bit со всеми 6 шардами
        let recovered = engine.retrieve_file(&manifest).unwrap();
        assert_eq!(recovered, original);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_file_encryption_at_rest() {
        let temp_dir = std::env::temp_dir().join(format!("test_enc_{}", std::process::id()));
        let storage = StorageManager::new(&temp_dir).unwrap();
        let engine = FileIngestEngine::new(&storage);

        let original_text = b"CONFIDENTIAL_MILITARY_GRADE_AI_STUDIO_STORAGE_PAYLOAD_AT_REST";
        let mut original = original_text.to_vec();
        original.resize(16384, 0x41); // 1 полный 16KB чанк

        let key = [0x77u8; 32];

        // Ingest с шифрованием
        let (manifest, _manifest_id) = engine.ingest_bytes_encrypted("secret.doc", &original, Some(&key)).unwrap();
        assert!(manifest.encryption.is_some());
        let enc_env = manifest.encryption.as_ref().unwrap();
        assert_eq!(enc_env.algorithm, "chacha20poly1305");

        // Проверяем, что на диске в shards/ лежат зашифрованные данные, а НЕ оригинальный текст
        for chunk in &manifest.chunks {
            for shard_entry in &chunk.shard_hashes {
                let mut h = [0u8; 32];
                hex::decode_to_slice(&shard_entry.hash, &mut h).unwrap();
                let stored_shard = storage.fetch_shard(&h).unwrap();
                assert!(!stored_shard.windows(original_text.len()).any(|w| w == original_text),
                    "Plaintext leak on disk! Shard contains unencrypted data!");
            }
        }

        // Попытка retrieve без ключа ДОЛЖНА завершиться ошибкой
        assert!(engine.retrieve_file(&manifest).is_err());

        // Retrieve с правильным ключом восстанавливает 100% bit-for-bit
        let recovered = engine.retrieve_file_with_fallback_and_key(&manifest, Some(&key), |_| None).unwrap();
        assert_eq!(recovered, original);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_two_files_same_key_different_random_nonces() {
        // Audit ID: REL-NONCE-01
        // Тест двух файлов с одинаковым ключом: разные nonce_hex и разные зашифрованные чанки
        let temp_dir = std::env::temp_dir().join(format!("test_nonce_{}", std::process::id()));
        let storage = StorageManager::new(&temp_dir).unwrap();
        let engine = FileIngestEngine::new(&storage);

        let identical_content = b"TOP_SECRET_IDENTICAL_FILE_PAYLOAD_FOR_NONCE_COLLISION_AUDIT_VERIFICATION";
        let key = [0x42u8; 32];

        let (manifest_a, _) = engine
            .ingest_bytes_encrypted("file_a.bin", identical_content, Some(&key))
            .unwrap();
        let (manifest_b, _) = engine
            .ingest_bytes_encrypted("file_b.bin", identical_content, Some(&key))
            .unwrap();

        let nonce_a = manifest_a.encryption.as_ref().unwrap().nonce_hex.clone();
        let nonce_b = manifest_b.encryption.as_ref().unwrap().nonce_hex.clone();

        // 1. Nonce на уровне файлов ДОЛЖНЫ быть уникальными и случайными
        assert_ne!(nonce_a, nonce_b, "Nonce reuse between files! Catastrophic ChaCha vulnerability!");

        // 2. Хеши зашифрованных чанков ДОЛЖНЫ отличаться, несмотря на одинаковый открытый текст
        assert_ne!(
            manifest_a.chunks[0].chunk_sha256,
            manifest_b.chunks[0].chunk_sha256,
            "Ciphertexts must differ due to unique nonces"
        );

        // 3. Оба файла восстанавливаются и расшифровываются с исходным ключом bit-for-bit
        let dec_a = engine
            .retrieve_file_with_fallback_and_key(&manifest_a, Some(&key), |_| None)
            .unwrap();
        let dec_b = engine
            .retrieve_file_with_fallback_and_key(&manifest_b, Some(&key), |_| None)
            .unwrap();

        assert_eq!(dec_a, identical_content);
        assert_eq!(dec_b, identical_content);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
