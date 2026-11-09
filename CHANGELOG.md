# 📜 Changelog

All notable changes to the **NeXXUs** decentralized storage node project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-beta.1] - 2026-11-09

### 🚀 Public Beta Release Candidate (Sprint 1–3 Consolidation)

This release marks the first public beta candidate of the NeXXUs Sovereign Storage Node (`nexxusd`), establishing a production-grade decentralized file pipeline, Reed-Solomon fault-tolerance, mesh distribution, Zero-Knowledge encryption at rest, and an anti-free-rider economic payment gate.

### ✨ Added
- **File Ingest & Retrieval Pipeline (`nexxusd put` / `get`)**:
  - Automated chunking of arbitrary files into 16 KB aligned blocks.
  - Deterministic Content-Addressed Storage (CAS) with SHA-256 hashing.
  - Canonical JSON `FileManifest` referencing chunk entries and shard hashes.
  - Bit-for-bit file reconstruction with automatic zero-padding removal.
- **Reed-Solomon Erasure Coding (RS 4+2)**:
  - 4 data shards + 2 parity shards (4096 bytes each) per 16 KB chunk.
  - Tolerates complete loss or corruption of any 2 out of 6 shards without data loss.
  - Formal verification proofs guaranteeing invertibility across all 15 generator submatrices.
- **P2P Mesh Distribution & Durability (`nexxusd put --peers` / `get --peers`)**:
  - Binary wire protocol framing with Big-Endian layout, `NEXX` magic bytes, and CRC32 verification.
  - P2P wire opcodes: `StoreShard (0x13)`, `FetchShard (0x14)`, `ShardStoredAck (0x15)`.
  - Remote fallback retrieval: automatically queries connected peers when local CAS misses occur and caches recovered shards locally.
  - Bootstrap peer management: `nexxusd serve --bootstrap <host:port,...>` with persistent `peers.json`.
- **Self-Healing & Repair (`nexxusd repair`)**:
  - Reconstructs damaged or missing shards across local CAS using remaining quorum shards.
  - Pulls surviving shards from remote mesh peers and pushes reconstructed shards back to the mesh.
- **Zero-Knowledge Encryption at Rest (ChaCha20-Poly1305)**:
  - Cryptographically secure 96-bit random per-file nonce (`file_nonce`), stored in `EncryptionEnvelope`.
  - Per-chunk unique nonce derivation (`file_nonce ⊕ chunk_idx`) preventing nonce reuse attacks.
  - Zero plaintext leakage to physical storage media.
  - Secure key management: `--key-file <path>` and `NEXXUS_FILE_KEY` environment variable with process listing protection (`ps`/`top`).
- **DePIN Economic Payment Gate & Anti-Free-Rider Defense**:
  - Gated `FetchChunk` and `FetchShard` wire handlers enforcing reciprocity.
  - Immediate `PaymentRequired (0x16)` rejection (`b"PAYMENT_REQUIRED"`) when requesting peers are uncredited or throttled.
  - Dynamic reputation system: exponential decay on failures (`score *= 0.7`) with quarantine threshold at $\le 0.2$.
  - State channel voucher settlement and credit balance restoration.
- **Proof-of-Retrievability (PoR) Auditing (`nexxusd challenge`)**:
  - Rapid cryptographic verification of held shards against SHA-256 CAS hashes.
  - Selective audit via `--manifest <id>` or batch audit across all shards via `--all`.
- **Node Passport & Security Hardening**:
  - Automatic `node_identity.json` generation with strict `0600` owner-only POSIX permissions.
  - CLI `nexxusd peers` command displaying registered peers, throttled nodes, and DePIN credit telemetry.

### 🧪 Explicit Simulation Modules (`[SIM]`)
To maintain complete transparency for security auditors and testers, the following subsystems currently run in high-fidelity simulation mode:
- **Tor v3 (`[SIM]`)**: Real Ed25519-derived `.onion` address generation; wire transport runs on native TCP sockets (Arti live circuit integration scheduled for post-beta).
- **Post-Quantum Cryptography (`[SIM]`)**: ML-KEM-768 (Kyber) and X25519 hybrid roundtrip verified in simulation harness.
- **ZK-SNARK PoR (`[SIM]`)**: Succinct 384-byte proof generation simulator.
- **io_uring NVMe Engine (`[SIM]`)**: Zero-syscall SQPOLL simulator with standard page-aligned `O_DIRECT` block fallback.
- **eBPF / XDP Driver Defense (`[SIM]`)**: User-space ring buffer and rule generator simulator.
- **Kademlia DHT (`[SIM]`)**: In-memory routing table and XOR distance calculation; beta.1 uses explicit bootstrap peering (`peers.json`).

### ⚠️ Known Limitations (Public Beta v2.0.0-beta.1)
1. **NAT Traversal**: Nodes behind symmetric or restricted NAT require port forwarding or public IP binding for incoming P2P connections on port `4000/TCP`.
2. **Opt-In Encryption**: Data-at-rest encryption is activated by providing `--key-file` or `NEXXUS_FILE_KEY`; unkeyed files are stored as plain CAS chunks.
3. **Economic Settlement**: The micropayment gate operates via off-chain bilateral state channels and reputation scoring without an L1 blockchain anchor.
