//! NeXXUs Storage Engine
//!
//! Manages 16 GB barter sections and direct high-throughput NVMe I/O
//! for 16 KB chunks with hardware-accelerated Proof-of-Retrievability (PoR).

use nexxus_core::{CHUNK_SIZE_BYTES, NexxusError, Result, SECTION_SIZE_BYTES};
use nexxus_crypto::compute_merkle_root;
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};

pub mod direct_io;
pub mod io_ring;
pub mod self_healing;
pub mod state_channel;
pub mod zk_por;

pub use direct_io::{DirectBlockDevice, DirectIoMode};
pub use io_ring::{CompletionQueueEntry, IoRingEngine, RingOpcode, RingTelemetry, SubmissionQueueEntry};
pub use self_healing::{MeshSelfHealingEngine, PeerNodeCandidate, SelfHealingEvent};
pub use state_channel::{
    ChannelState, DePinBarterEngine, DePinTelemetry, PeerReputation, SignedChannelCommitment,
    StateChannel, TransferDirection,
};
pub use zk_por::{ZkPorCommitment, ZkPorEngine, ZkPorProof};

pub const CHUNKS_PER_SECTION: usize = (SECTION_SIZE_BYTES / (CHUNK_SIZE_BYTES as u64)) as usize; // 1,048,576 chunks
pub const SECTOR_SIZE_BYTES: usize = 256;
pub const SECTORS_PER_CHUNK: usize = CHUNK_SIZE_BYTES / SECTOR_SIZE_BYTES; // 64 sectors

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
        Ok(Self { base_dir: path })
    }

    /// Allocates or opens a 16 GB barter section file
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
