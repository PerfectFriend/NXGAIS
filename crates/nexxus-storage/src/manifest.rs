//! NeXXUs File Manifest — content-addressed file descriptor
//!
//! Audit ID: FEAT-MANIFEST-01
//! Описывает файл как набор 16KB чанков, каждый из которых RS-кодирован
//! в 6 шардов (4 data + 2 parity). Манифест сериализуется в canonical JSON
//! и сам имеет content-address (SHA-256 канонического JSON).

use nexxus_core::{RS_DATA_SHARDS, RS_TOTAL_SHARDS};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Описание одного RS-шарда в манифесте
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ShardEntry {
    /// Индекс шарда (0..5)
    pub index: usize,
    /// true для parity-шардов (4, 5)
    pub is_parity: bool,
    /// SHA-256 hex содержимого шарда (ключ CAS)
    pub hash: String,
}

/// Описание одного 16KB чанка файла
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChunkEntry {
    /// Порядковый индекс чанка в файле
    pub index: usize,
    /// SHA-256 hex исходного 16KB блока (до RS-кодирования)
    pub chunk_sha256: String,
    /// 6 RS-шардов (4 data + 2 parity)
    pub shard_hashes: Vec<ShardEntry>,
}

/// Манифест файла — корневой документ put/get пайплайна
/// Audit ID: FEAT-MANIFEST-01
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileManifest {
    /// Версия формата манифеста
    pub version: u32,
    /// Имя исходного файла
    pub file_name: String,
    /// Размер исходного файла в байтах
    pub file_size: u64,
    /// Количество 16KB чанков
    pub chunk_count: usize,
    /// Количество data-шардов в RS-схеме
    pub rs_data: usize,
    /// Общее количество шардов в RS-схеме
    pub rs_total: usize,
    /// Длина хвоста последнего чанка (до zero-pad до 16KB).
    /// Для файлов кратных CHUNK_SIZE = 0 (означает полный чанк).
    pub original_tail_len: usize,
    /// Описание чанков с SHA-256 хешами шардов
    pub chunks: Vec<ChunkEntry>,
}

impl FileManifest {
    /// Создаёт пустой манифест-шаблон
    pub fn new(file_name: String, file_size: u64) -> Self {
        Self {
            version: 1,
            file_name,
            file_size,
            chunk_count: 0,
            rs_data: RS_DATA_SHARDS,
            rs_total: RS_TOTAL_SHARDS,
            original_tail_len: 0,
            chunks: Vec::new(),
        }
    }

    /// Сериализует манифест в canonical JSON (sorted keys, no trailing whitespace)
    pub fn to_canonical_json(&self) -> nexxus_core::Result<String> {
        serde_json::to_string_pretty(self).map_err(|e| {
            nexxus_core::NexxusError::StorageError(format!(
                "Failed to serialize manifest: {:?}",
                e
            ))
        })
    }

    /// Десериализует манифест из JSON
    pub fn from_json(json: &str) -> nexxus_core::Result<Self> {
        serde_json::from_str(json).map_err(|e| {
            nexxus_core::NexxusError::StorageError(format!(
                "Failed to deserialize manifest: {:?}",
                e
            ))
        })
    }

    /// Вычисляет manifest_id = SHA-256(canonical_json)
    pub fn manifest_id(&self) -> nexxus_core::Result<String> {
        let json = self.to_canonical_json()?;
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        Ok(hex::encode(hasher.finalize()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_roundtrip_serialize() {
        let mut m = FileManifest::new("test.bin".into(), 50000);
        m.chunk_count = 4;
        m.original_tail_len = 50000 % (16 * 1024); // 864 bytes
        m.chunks.push(ChunkEntry {
            index: 0,
            chunk_sha256: "aabb".repeat(16),
            shard_hashes: (0..6)
                .map(|i| ShardEntry {
                    index: i,
                    is_parity: i >= 4,
                    hash: format!("shard{}hash", i),
                })
                .collect(),
        });

        let json = m.to_canonical_json().unwrap();
        let m2 = FileManifest::from_json(&json).unwrap();
        assert_eq!(m, m2);

        let id1 = m.manifest_id().unwrap();
        let id2 = m2.manifest_id().unwrap();
        assert_eq!(id1, id2);
        assert_eq!(id1.len(), 64); // SHA-256 hex = 64 chars
    }

    #[test]
    fn test_manifest_rs_defaults() {
        let m = FileManifest::new("hello.txt".into(), 100);
        assert_eq!(m.rs_data, 4);
        assert_eq!(m.rs_total, 6);
        assert_eq!(m.version, 1);
    }
}
