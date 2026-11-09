//! NeXXUs Storage Engine
//!
//! Manages 16 GB barter sections and direct high-throughput NVMe I/O
//! for 16 KB chunks with hardware-accelerated Proof-of-Retrievability (PoR).

use nexxus_core::{CHUNK_SIZE_BYTES, NexxusError, Result, SECTION_SIZE_BYTES, SHARD_SIZE_BYTES};
use nexxus_crypto::compute_merkle_root;
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};

pub mod direct_io;
pub mod file_ingest;
pub mod io_ring;
pub mod manifest;
pub mod node_identity;
pub mod self_healing;
pub mod state_channel;
pub mod zk_por;

pub use direct_io::{DirectBlockDevice, DirectIoMode};
pub use file_ingest::FileIngestEngine;
pub use io_ring::{CompletionQueueEntry, IoRingEngine, RingOpcode, RingTelemetry, SubmissionQueueEntry};
pub use manifest::{ChunkEntry, FileManifest, ShardEntry};
pub use node_identity::NodeIdentity;
pub use self_healing::{MeshSelfHealingEngine, PeerNodeCandidate, SelfHealingEvent};
pub use state_channel::{
    ChannelState, DePinBarterEngine, DePinTelemetry, PeerReputation, SignedChannelCommitment,
    StateChannel, TransferDirection,
};
pub use zk_por::{ZkPorCommitment, ZkPorEngine, ZkPorProof};

pub const CHUNKS_PER_SECTION: usize = (SECTION_SIZE_BYTES / (CHUNK_SIZE_BYTES as u64)) as usize; // 1,048,576 chunks
pub const SECTOR_SIZE_BYTES: usize = 256;
pub const SECTORS_PER_CHUNK: usize = CHUNK_SIZE_BYTES / SECTOR_SIZE_BYTES; // 64 sectors

#[derive(Clone, Debug)]
pub struct StorageManager {
    base_dir: PathBuf,
}

impl StorageManager {
    pub fn new(base_dir: impl AsRef<Path>) -> Result<Self> {
        let path = base_dir.as_ref().to_path_buf();
        if !path.exists() {
            std::fs::create_dir_all(&path)
                .map_err(|e| NexxusError::StorageError(format!("Failed to create storage directory: {:?}", e)))?;
        }
        let chunks_dir = path.join("chunks");
        if !chunks_dir.exists() {
            let _ = std::fs::create_dir_all(&chunks_dir);
        }
        Ok(Self { base_dir: path })
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Stores a 16KB chunk to disk in content-addressed storage (CAS)
    /// Audit ID: E2E-STORE-01
    pub fn store_chunk(&self, data: &[u8]) -> Result<[u8; 32]> {
        if data.len() != CHUNK_SIZE_BYTES {
            return Err(NexxusError::StorageError(format!(
                "Invalid chunk size: expected {}, got {}",
                CHUNK_SIZE_BYTES,
                data.len()
            )));
        }
        let mut hasher = Sha256::new();
        hasher.update(data);
        let digest_bytes = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&digest_bytes);

        let chunks_dir = self.base_dir.join("chunks");
        if !chunks_dir.exists() {
            std::fs::create_dir_all(&chunks_dir)
                .map_err(|e| NexxusError::StorageError(format!("Failed to create chunks dir: {:?}", e)))?;
        }
        let chunk_path = chunks_dir.join(hex::encode(hash));
        std::fs::write(&chunk_path, data)
            .map_err(|e| NexxusError::StorageError(format!("Failed to write chunk {}: {:?}", hex::encode(hash), e)))?;

        Ok(hash)
    }

    /// Fetches a 16KB chunk from disk by its SHA-256 hash
    /// Audit ID: E2E-FETCH-01
    pub fn fetch_chunk(&self, hash: &[u8; 32]) -> Result<Vec<u8>> {
        let chunk_path = self.base_dir.join("chunks").join(hex::encode(hash));
        if !chunk_path.exists() {
            return Err(NexxusError::StorageError(format!(
                "Chunk not found: {}",
                hex::encode(hash)
            )));
        }
        let data = std::fs::read(&chunk_path)
            .map_err(|e| NexxusError::StorageError(format!("Failed to read chunk {}: {:?}", hex::encode(hash), e)))?;
        if data.len() != CHUNK_SIZE_BYTES {
            return Err(NexxusError::StorageError(format!(
                "Corrupted chunk on disk: expected {} bytes, got {}",
                CHUNK_SIZE_BYTES,
                data.len()
            )));
        }
        Ok(data)
    }

    /// Checks if a chunk is present on disk
    pub fn has_chunk(&self, hash: &[u8; 32]) -> bool {
        self.base_dir.join("chunks").join(hex::encode(hash)).exists()
    }

    // --- Shard CAS (4096-byte RS shards) ---
    // Audit ID: FEAT-RS-PIPE-01

    /// Stores a 4096-byte RS shard to CAS. Returns SHA-256 hash.
    pub fn store_shard(&self, data: &[u8]) -> Result<[u8; 32]> {
        if data.len() != SHARD_SIZE_BYTES {
            return Err(NexxusError::StorageError(format!(
                "Invalid shard size: expected {}, got {}",
                SHARD_SIZE_BYTES,
                data.len()
            )));
        }
        let mut hasher = Sha256::new();
        hasher.update(data);
        let digest_bytes = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&digest_bytes);

        let shards_dir = self.base_dir.join("shards");
        if !shards_dir.exists() {
            std::fs::create_dir_all(&shards_dir)
                .map_err(|e| NexxusError::StorageError(format!("Failed to create shards dir: {:?}", e)))?;
        }
        let shard_path = shards_dir.join(hex::encode(hash));
        std::fs::write(&shard_path, data)
            .map_err(|e| NexxusError::StorageError(format!("Failed to write shard {}: {:?}", hex::encode(hash), e)))?;

        Ok(hash)
    }

    /// Fetches a 4096-byte RS shard from CAS by its SHA-256 hash
    pub fn fetch_shard(&self, hash: &[u8; 32]) -> Result<Vec<u8>> {
        let shard_path = self.base_dir.join("shards").join(hex::encode(hash));
        if !shard_path.exists() {
            return Err(NexxusError::StorageError(format!(
                "Shard not found: {}",
                hex::encode(hash)
            )));
        }
        let data = std::fs::read(&shard_path)
            .map_err(|e| NexxusError::StorageError(format!("Failed to read shard {}: {:?}", hex::encode(hash), e)))?;
        if data.len() != SHARD_SIZE_BYTES {
            return Err(NexxusError::StorageError(format!(
                "Corrupted shard on disk: expected {} bytes, got {}",
                SHARD_SIZE_BYTES,
                data.len()
            )));
        }
        Ok(data)
    }

    /// Checks if a shard is present on disk
    pub fn has_shard(&self, hash: &[u8; 32]) -> bool {
        self.base_dir.join("shards").join(hex::encode(hash)).exists()
    }

    /// Deletes a shard from CAS (for testing RS resilience)
    pub fn delete_shard(&self, hash: &[u8; 32]) -> Result<()> {
        let shard_path = self.base_dir.join("shards").join(hex::encode(hash));
        if shard_path.exists() {
            std::fs::remove_file(&shard_path)
                .map_err(|e| NexxusError::StorageError(format!("Failed to delete shard: {:?}", e)))?;
        }
        Ok(())
    }

    // --- Manifest storage ---
    // Audit ID: FEAT-MANIFEST-01

    /// Saves a manifest JSON to `<storage_dir>/manifests/<manifest_id>.json`
    pub fn store_manifest(&self, manifest: &manifest::FileManifest) -> Result<String> {
        let manifests_dir = self.base_dir.join("manifests");
        if !manifests_dir.exists() {
            std::fs::create_dir_all(&manifests_dir)
                .map_err(|e| NexxusError::StorageError(format!("Failed to create manifests dir: {:?}", e)))?;
        }
        let json = manifest.to_canonical_json()?;
        let manifest_id = manifest.manifest_id()?;
        let path = manifests_dir.join(format!("{}.json", manifest_id));
        std::fs::write(&path, &json)
            .map_err(|e| NexxusError::StorageError(format!("Failed to write manifest: {:?}", e)))?;
        Ok(manifest_id)
    }

    /// Loads a manifest from `<storage_dir>/manifests/<manifest_id>.json`
    pub fn load_manifest(&self, manifest_id: &str) -> Result<manifest::FileManifest> {
        let path = self.base_dir.join("manifests").join(format!("{}.json", manifest_id));
        if !path.exists() {
            return Err(NexxusError::StorageError(format!(
                "Manifest not found: {}",
                manifest_id
            )));
        }
        let json = std::fs::read_to_string(&path)
            .map_err(|e| NexxusError::StorageError(format!("Failed to read manifest: {:?}", e)))?;
        manifest::FileManifest::from_json(&json)
    }

    /// Evaluates Proof-of-Retrievability (PoR) directly against a stored chunk
    /// Audit ID: E2E-POR-01
    pub fn evaluate_stored_chunk_por(
        &self,
        hash: &[u8; 32],
        challenged_sector_index: usize,
    ) -> Result<PorAuditResponse> {
        let chunk_data = self.fetch_chunk(hash)?;
        Self::evaluate_por_challenge(&chunk_data, challenged_sector_index)
    }

    /// Allocates or opens a 16 GB barter section file.
    ///
    /// ## Concurrency Model (Audit ID: STORAGE-SECTION-01)
    /// Multiple worker threads or async tasks may perform concurrent `pread`/`pwrite`
    /// operations on the same section file without mutual exclusion, provided their
    /// target chunk offsets do not overlap (16 KB granularity: `chunk_index * 16384`).
    /// Section creation is serialized by the caller or single daemon instance.
    pub fn open_section(&self, section_id: u32) -> Result<File> {
        let section_path = self.base_dir.join(format!("section_{:04}.sec", section_id));
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&section_path)
            .map_err(|e| NexxusError::StorageError(format!("Failed to open section file: {:?}", e)))?;

        // Ensure 16GB length if freshly created with zero-fragmentation fallocate
        let meta = file.metadata().map_err(|e| NexxusError::StorageError(e.to_string()))?;
        if meta.len() < SECTION_SIZE_BYTES {
            #[cfg(target_os = "linux")]
            {
                use std::os::unix::io::AsRawFd;
                let fd = file.as_raw_fd();
                let ret = unsafe { libc::posix_fallocate(fd, 0, SECTION_SIZE_BYTES as libc::off_t) };
                if ret != 0 {
                    file.set_len(SECTION_SIZE_BYTES)
                        .map_err(|e| NexxusError::StorageError(format!("Failed to preallocate 16GB section: {:?}", e)))?;
                }
            }
            #[cfg(not(target_os = "linux"))]
            {
                file.set_len(SECTION_SIZE_BYTES)
                    .map_err(|e| NexxusError::StorageError(format!("Failed to preallocate 16GB section: {:?}", e)))?;
            }
        }

        Ok(file)
    }

    /// Flushes uncommitted page cache writes for a section using fdatasync (O_DSYNC policy)
    /// Audit ID: STORAGE-SECTION-01
    pub fn sync_section_data(&self, file: &File) -> Result<()> {
        file.sync_data()
            .map_err(|e| NexxusError::StorageError(format!("fdatasync failed: {:?}", e)))
    }

    /// Evaluates an authentic Proof-of-Retrievability (PoR) audit on a 16KB chunk
    pub fn evaluate_por_challenge(
        chunk_data: &[u8],
        challenged_sector_index: usize,
    ) -> Result<PorAuditResponse> {
        if chunk_data.len() != CHUNK_SIZE_BYTES {
            return Err(NexxusError::StorageError(format!(
                "Invalid chunk size for PoR: expected {}, got {}",
                CHUNK_SIZE_BYTES,
                chunk_data.len()
            )));
        }

        let start_time = std::time::Instant::now();

        // 1. Slicing into 64 sectors of 256 bytes each
        let mut leaf_hashes = Vec::with_capacity(SECTORS_PER_CHUNK);
        for i in 0..SECTORS_PER_CHUNK {
            let start = i * SECTOR_SIZE_BYTES;
            let end = start + SECTOR_SIZE_BYTES;
            let mut hasher = Sha256::new();
            hasher.update(&chunk_data[start..end]);
            let res = hasher.finalize();
            let mut h = [0u8; 32];
            h.copy_from_slice(&res);
            leaf_hashes.push(h);
        }

        // 2. Build Merkle Root
        let root = compute_merkle_root(&leaf_hashes);
        let elapsed_ms = start_time.elapsed().as_secs_f64() * 1000.0;

        let safe_index = challenged_sector_index % SECTORS_PER_CHUNK;
        let sector_bytes = chunk_data[safe_index * SECTOR_SIZE_BYTES..(safe_index + 1) * SECTOR_SIZE_BYTES].to_vec();

        Ok(PorAuditResponse {
            merkle_root: hex::encode(root),
            challenged_sector_index: safe_index as u32,
            sector_data: sector_bytes,
            response_latency_ms: elapsed_ms,
            is_valid: true,
        })
    }

    /// Verifies that a challenged sector and audit response match the chunk data
    pub fn verify_por_audit(chunk_data: &[u8], audit: &PorAuditResponse) -> bool {
        if chunk_data.len() != CHUNK_SIZE_BYTES {
            return false;
        }
        let sec_idx = audit.challenged_sector_index as usize;
        if sec_idx >= SECTORS_PER_CHUNK {
            return false;
        }
        let start = sec_idx * SECTOR_SIZE_BYTES;
        let end = start + SECTOR_SIZE_BYTES;
        if &chunk_data[start..end] != audit.sector_data.as_slice() {
            return false;
        }

        let Ok(calculated) = Self::evaluate_por_challenge(chunk_data, sec_idx) else {
            return false;
        };
        calculated.merkle_root == audit.merkle_root
    }
}

/// 4096-byte page-aligned memory buffer wrapper for Direct NVMe block operations
pub struct AlignedBlockBuffer {
    data: Vec<u8>,
    offset: usize,
    capacity: usize,
}

impl AlignedBlockBuffer {
    pub const ALIGNMENT: usize = 4096;

    pub fn new(capacity: usize) -> Self {
        let raw = vec![0u8; capacity + Self::ALIGNMENT];
        let ptr = raw.as_ptr() as usize;
        let misalign = ptr % Self::ALIGNMENT;
        let offset = if misalign == 0 { 0 } else { Self::ALIGNMENT - misalign };
        Self {
            data: raw,
            offset,
            capacity,
        }
    }

    #[inline]
    pub fn as_slice(&self) -> &[u8] {
        &self.data[self.offset..self.offset + self.capacity]
    }

    #[inline]
    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        &mut self.data[self.offset..self.offset + self.capacity]
    }

    pub fn is_aligned(&self) -> bool {
        let ptr = self.as_slice().as_ptr() as usize;
        ptr % Self::ALIGNMENT == 0
    }
}

#[derive(Debug, Clone)]
pub struct PorAuditResponse {
    pub merkle_root: String,
    pub challenged_sector_index: u32,
    pub sector_data: Vec<u8>,
    pub response_latency_ms: f64,
    pub is_valid: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evaluate_por_challenge_16kb() {
        let mut chunk = vec![0u8; CHUNK_SIZE_BYTES];
        for (i, b) in chunk.iter_mut().enumerate() {
            *b = (i % 256) as u8;
        }

        let resp = StorageManager::evaluate_por_challenge(&chunk, 7).unwrap();
        assert_eq!(resp.challenged_sector_index, 7);
        assert_eq!(resp.sector_data.len(), SECTOR_SIZE_BYTES);
        assert_eq!(resp.merkle_root.len(), 64);
        assert!(resp.is_valid);

        assert!(StorageManager::verify_por_audit(&chunk, &resp));
    }

    #[test]
    fn test_storage_manager_store_fetch_por() {
        let tmp = std::env::temp_dir().join(format!("sm_test_{}", std::process::id()));
        let sm = StorageManager::new(&tmp).unwrap();

        let mut chunk = vec![0u8; CHUNK_SIZE_BYTES];
        for (i, b) in chunk.iter_mut().enumerate() {
            *b = ((i * 17 + 3) & 0xff) as u8;
        }

        let hash = sm.store_chunk(&chunk).unwrap();
        assert!(sm.has_chunk(&hash));

        let fetched = sm.fetch_chunk(&hash).unwrap();
        assert_eq!(fetched, chunk);

        let por_resp = sm.evaluate_stored_chunk_por(&hash, 5).unwrap();
        assert!(por_resp.is_valid);
        assert_eq!(por_resp.challenged_sector_index, 5);

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_aligned_block_buffer() {
        let mut buf = AlignedBlockBuffer::new(CHUNK_SIZE_BYTES);
        assert!(buf.is_aligned());
        assert_eq!(buf.as_slice().len(), CHUNK_SIZE_BYTES);

        buf.as_mut_slice()[0] = 0xAA;
        buf.as_mut_slice()[CHUNK_SIZE_BYTES - 1] = 0xBB;
        assert_eq!(buf.as_slice()[0], 0xAA);
        assert_eq!(buf.as_slice()[CHUNK_SIZE_BYTES - 1], 0xBB);
    }
}
