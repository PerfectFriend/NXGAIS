// [SIM] PLACEHOLDER — Simulated Submission/Completion Queue (SQ/CQ) Architecture.
// Audit ID: STORAGE-IORING-01 (Grok Audit #2).
// ATTENTION: This module simulates the interface of Linux io_uring (SQ/CQ batching,
// SQPOLL mode and registered buffers telemetry) on top of synchronous DirectBlockDevice.
// It does NOT execute native io_uring system calls (io_uring_setup, io_uring_enter).
// For production kernel bypass, integration of the `io-uring` or `tokio-uring` crate is required.

use crate::direct_io::DirectBlockDevice;
use crate::AlignedBlockBuffer;
use nexxus_core::{NexxusError, Result};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RingOpcode {
    Read,
    Write,
    Sync,
}

pub struct SubmissionQueueEntry {
    pub user_data: u64,
    pub opcode: RingOpcode,
    pub offset: u64,
    pub len: usize,
    pub data: Option<Vec<u8>>,
}

#[derive(Debug, Clone)]
pub struct CompletionQueueEntry {
    pub user_data: u64,
    pub result_bytes: usize,
    pub latency_micros: u64,
    pub success: bool,
    pub error_msg: Option<String>,
}

#[derive(Debug, Default)]
pub struct RingTelemetry {
    pub total_operations: AtomicU64,
    pub total_bytes: AtomicU64,
    pub total_latency_micros: AtomicU64,
    pub peak_queue_depth: AtomicU64,
}

pub struct IoRingEngine {
    sq: Vec<SubmissionQueueEntry>,
    queue_capacity: usize,
    sqpoll_enabled: bool,
    sqpoll_idle_ms: u32,
    registered_buffers_count: usize,
    pub telemetry: Arc<RingTelemetry>,
}

impl IoRingEngine {
    pub const DEFAULT_QUEUE_CAPACITY: usize = 1024;

    pub fn new(capacity: usize) -> Self {
        Self {
            sq: Vec::with_capacity(capacity),
            queue_capacity: capacity,
            sqpoll_enabled: false,
            sqpoll_idle_ms: 2000,
            registered_buffers_count: 0,
            telemetry: Arc::new(RingTelemetry::default()),
        }
    }

    /// [SIM] Simulates Linux kernel Submission Queue Polling (IORING_SETUP_SQPOLL)
    /// flags and telemetry tracking for NVMe I/O queues.
    pub fn enable_sqpoll(&mut self, idle_timeout_ms: u32) {
        self.sqpoll_enabled = true;
        self.sqpoll_idle_ms = idle_timeout_ms;
    }

    pub fn is_sqpoll_active(&self) -> bool {
        self.sqpoll_enabled
    }

    /// Registers DMA page buffers (IORING_REGISTER_BUFFERS) to pin physical memory
    pub fn register_dma_buffers(&mut self, buffer_count: usize) {
        self.registered_buffers_count = buffer_count;
    }

    pub fn registered_buffers(&self) -> usize {
        self.registered_buffers_count
    }

    /// Enqueues a read request into the Submission Queue
    pub fn prep_read(&mut self, user_data: u64, offset: u64, len: usize) -> Result<()> {
        if self.sq.len() >= self.queue_capacity {
            return Err(NexxusError::StorageError("Submission Queue is full".into()));
        }
        self.sq.push(SubmissionQueueEntry {
            user_data,
            opcode: RingOpcode::Read,
            offset,
            len,
            data: None,
        });
        Ok(())
    }

    /// Enqueues a write request into the Submission Queue
    pub fn prep_write(&mut self, user_data: u64, offset: u64, data: Vec<u8>) -> Result<()> {
        if self.sq.len() >= self.queue_capacity {
            return Err(NexxusError::StorageError("Submission Queue is full".into()));
        }
        let len = data.len();
        self.sq.push(SubmissionQueueEntry {
            user_data,
            opcode: RingOpcode::Write,
            offset,
            len,
            data: Some(data),
        });
        Ok(())
    }

    /// Submits all queued SQ entries to the direct block device in batch
    pub fn submit_and_wait(&mut self, device: &DirectBlockDevice) -> Vec<CompletionQueueEntry> {
        let entries_count = self.sq.len();
        if entries_count == 0 {
            return Vec::new();
        }

        self.telemetry
            .peak_queue_depth
            .fetch_max(entries_count as u64, Ordering::Relaxed);

        let mut completions = Vec::with_capacity(entries_count);

        for entry in self.sq.drain(..) {
            let start = Instant::now();
            let mut cqe = CompletionQueueEntry {
                user_data: entry.user_data,
                result_bytes: 0,
                latency_micros: 0,
                success: false,
                error_msg: None,
            };

            match entry.opcode {
                RingOpcode::Read => {
                    let mut buf = AlignedBlockBuffer::new(entry.len);
                    match device.read_block(entry.offset, &mut buf) {
                        Ok(n) => {
                            cqe.result_bytes = n;
                            cqe.success = true;
                            self.telemetry.total_bytes.fetch_add(n as u64, Ordering::Relaxed);
                        }
                        Err(e) => {
                            cqe.error_msg = Some(e.to_string());
                        }
                    }
                }
                RingOpcode::Write => {
                    if let Some(data) = entry.data {
                        let mut buf = AlignedBlockBuffer::new(data.len());
                        buf.as_mut_slice().copy_from_slice(&data);
                        match device.write_block(entry.offset, &buf) {
                            Ok(n) => {
                                cqe.result_bytes = n;
                                cqe.success = true;
                                self.telemetry.total_bytes.fetch_add(n as u64, Ordering::Relaxed);
                            }
                            Err(e) => {
                                cqe.error_msg = Some(e.to_string());
                            }
                        }
                    }
                }
                RingOpcode::Sync => {
                    cqe.success = true;
                }
            }

            let elapsed = start.elapsed().as_micros() as u64;
            cqe.latency_micros = elapsed;
            self.telemetry
                .total_latency_micros
                .fetch_add(elapsed, Ordering::Relaxed);
            self.telemetry
                .total_operations
                .fetch_add(1, Ordering::Relaxed);

            completions.push(cqe);
        }

        completions
    }

    /// Computes average batch I/O latency in microseconds
    pub fn average_latency_micros(&self) -> f64 {
        let ops = self.telemetry.total_operations.load(Ordering::Relaxed);
        if ops == 0 {
            0.0
        } else {
            let total = self.telemetry.total_latency_micros.load(Ordering::Relaxed);
            total as f64 / ops as f64
        }
    }
}
