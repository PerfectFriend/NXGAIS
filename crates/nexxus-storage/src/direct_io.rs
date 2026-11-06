//! Direct NVMe Block Device with O_DIRECT Page Cache Bypass
//!
//! Phase 2.2: Zero-copy DMA I/O aligned to 4096-byte boundaries.
//! Eliminates Linux kernel page cache bouncing and reduces jitter for PoR audits.

use crate::AlignedBlockBuffer;
use nexxus_core::{NexxusError, Result};
use std::fs::{File, OpenOptions};
use std::os::unix::fs::OpenOptionsExt;
use std::os::unix::io::{AsRawFd, RawFd};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DirectIoMode {
    /// True Linux kernel O_DIRECT with DMA zero-copy bypass
    HardwareDirect,
    /// 4096-byte aligned fallback (e.g., when filesystem does not support O_DIRECT)
    AlignedFallback,
}

pub struct DirectBlockDevice {
    _file: File,
    path: PathBuf,
    mode: DirectIoMode,
    fd: RawFd,
}

impl DirectBlockDevice {
    /// Opens or creates a block device file with direct I/O enabled
    pub fn open(path: impl AsRef<Path>, preallocate_bytes: Option<u64>) -> Result<Self> {
        let p = path.as_ref().to_path_buf();
        if let Some(parent) = p.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        // 1. Attempt opening with O_DIRECT | O_SYNC | O_RDWR
        #[cfg(target_os = "linux")]
        let direct_res = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .custom_flags(libc::O_DIRECT | libc::O_SYNC)
            .open(&p);

        #[cfg(not(target_os = "linux"))]
        let direct_res: std::io::Result<File> = Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "O_DIRECT only natively supported on Linux",
        ));

        let (file, mode) = match direct_res {
            Ok(f) => (f, DirectIoMode::HardwareDirect),
            Err(_) => {
                // Fallback to standard open with O_SYNC while enforcing 4KB page alignment
                let f = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .create(true)
                    .custom_flags(libc::O_SYNC)
                    .open(&p)
                    .map_err(|e| NexxusError::StorageError(format!("Failed to open file: {:?}", e)))?;
                (f, DirectIoMode::AlignedFallback)
            }
        };

        let fd = file.as_raw_fd();

        // 2. Preallocate if requested
        if let Some(bytes) = preallocate_bytes {
            let meta = file.metadata().map_err(|e| NexxusError::StorageError(e.to_string()))?;
            if meta.len() < bytes {
                #[cfg(target_os = "linux")]
                {
                    let ret = unsafe { libc::posix_fallocate(fd, 0, bytes as libc::off_t) };
                    if ret != 0 {
                        let _ = file.set_len(bytes);
                    }
                }
                #[cfg(not(target_os = "linux"))]
                {
                    let _ = file.set_len(bytes);
                }
            }
        }

        Ok(Self {
            _file: file,
            path: p,
            mode,
            fd,
        })
    }

    pub fn mode(&self) -> DirectIoMode {
        self.mode
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Direct unbuffered write of an aligned 4KB block buffer
    pub fn write_block(&self, offset: u64, buffer: &AlignedBlockBuffer) -> Result<usize> {
        if !buffer.is_aligned() {
            return Err(NexxusError::StorageError(
                "Buffer is not aligned to 4096-byte page boundary".into(),
            ));
        }
        if offset % (AlignedBlockBuffer::ALIGNMENT as u64) != 0 {
            return Err(NexxusError::StorageError(
                "Offset must be aligned to 4096-byte boundary for Direct I/O".into(),
            ));
        }

        let slice = buffer.as_slice();
        let bytes_to_write = slice.len();

        let ret = unsafe {
            libc::pwrite(
                self.fd,
                slice.as_ptr() as *const libc::c_void,
                bytes_to_write,
                offset as libc::off_t,
            )
        };

        if ret < 0 {
            let err = std::io::Error::last_os_error();
            return Err(NexxusError::StorageError(format!("Direct write failed: {:?}", err)));
        }

        Ok(ret as usize)
    }

    /// Direct unbuffered read into an aligned 4KB block buffer
    pub fn read_block(&self, offset: u64, buffer: &mut AlignedBlockBuffer) -> Result<usize> {
        if !buffer.is_aligned() {
            return Err(NexxusError::StorageError(
                "Buffer is not aligned to 4096-byte page boundary".into(),
            ));
        }
        if offset % (AlignedBlockBuffer::ALIGNMENT as u64) != 0 {
            return Err(NexxusError::StorageError(
                "Offset must be aligned to 4096-byte boundary for Direct I/O".into(),
            ));
        }

        let slice = buffer.as_mut_slice();
        let bytes_to_read = slice.len();

        let ret = unsafe {
            libc::pread(
                self.fd,
                slice.as_mut_ptr() as *mut libc::c_void,
                bytes_to_read,
                offset as libc::off_t,
            )
        };

        if ret < 0 {
            let err = std::io::Error::last_os_error();
            return Err(NexxusError::StorageError(format!("Direct read failed: {:?}", err)));
        }

        Ok(ret as usize)
    }
}
