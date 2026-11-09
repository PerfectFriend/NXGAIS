//! NeXXUs File Ingest & Retrieval Engine
//!
//! Audit ID: FEAT-RS-PIPE-01, FEAT-FILE-PUT-01, FEAT-FILE-GET-01
//! Реализует сквозной конвейер:
//! - File -> Chunks (16KB) -> RS(4+2) shards (4KB) -> CAS -> Manifest
//! - Manifest -> Fetch shards (>=4 per chunk) -> Reconstruct RS -> Strip tail -> Reconstructed File

use crate::manifest::{ChunkEntry, FileManifest, ShardEntry};
use crate::StorageManager;
use nexxus_core::{CHUNK_SIZE_BYTES, NexxusError, Result, RS_DATA_SHARDS, RS_TOTAL_SHARDS};
use nexxus_crypto::{encode_reed_solomon, reconstruct_reed_solomon, Shard};
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

        self.ingest_bytes(&file_name, &file_bytes)
    }

    /// Поглощает байты в памяти, формирует шарды и сохраняет манифест в CAS.
    pub fn ingest_bytes(&self, file_name: &str, data: &[u8]) -> Result<(FileManifest, String)> {
        let file_size = data.len() as u64;
        let mut manifest = FileManifest::new(file_name.to_string(), file_size);

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

            // 2. Вычисляем hash оригинального 16KB чанка
            let mut hasher = Sha256::new();
            hasher.update(&chunk_buf);
            let chunk_sha256 = hex::encode(hasher.finalize());

            // 3. RS(4+2) кодирование -> 6 шардов по 4096 байт
            let shards = encode_reed_solomon(&chunk_buf)?;

            // 4. Сохраняем каждый шард в CAS
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
        if manifest.chunk_count == 0 || manifest.file_size == 0 {
            return Ok(Vec::new());
        }

        let mut reconstructed_data = Vec::with_capacity(manifest.file_size as usize);

        for (idx, chunk_entry) in manifest.chunks.iter().enumerate() {
            // Собираем доступные шарды из хранилища
            let mut available_shards = Vec::new();
            for shard_entry in &chunk_entry.shard_hashes {
                let mut hash_bytes = [0u8; 32];
                if hex::decode_to_slice(&shard_entry.hash, &mut hash_bytes).is_ok() {
                    if let Ok(shard_data) = self.storage.fetch_shard(&hash_bytes) {
                        available_shards.push(Shard {
                            index: shard_entry.index,
                            is_parity: shard_entry.is_parity,
                            data: shard_data,
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

            // Хвост последнего чанка обрезается до исходного размера
            if idx == manifest.chunk_count - 1 {
                let tail_len = manifest.original_tail_len;
                let take_len = if tail_len == 0 || tail_len > CHUNK_SIZE_BYTES {
                    CHUNK_SIZE_BYTES
                } else {
                    tail_len
                };
                reconstructed_data.extend_from_slice(&chunk_bytes[..take_len]);
            } else {
                reconstructed_data.extend_from_slice(&chunk_bytes);
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
}
