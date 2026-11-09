<p align="center">
  <img src="assets/images/banner-top.jpg" alt="NeXXUs Sovereign Crypto-Cloud Hosting — Cyberpunk Banner" width="100%" style="border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);" />
</p>

# 🌌 NeXXUs — Decentralized Crypto-Cloud & Sovereign P2P Storage Mesh

> **Sovereign, trustless Peer-to-Peer platform for ultra-secure storage of confidential data, keys, seed phrases, and private archives — completely independent of cloud monopolies, centralized data centers, and corporate surveillance.**

<p align="center">
  <b>🌐 Language / Язык / Idioma:</b><br>
  <b>English (EN)</b> •
  <a href="README.ru.md"><b>Русский (RU)</b></a> •
  <a href="README.es.md"><b>Español (ES)</b></a>
</p>

---

[![Rust Core](https://img.shields.io/badge/Core-100%25_Native_Rust-orange?style=for-the-badge&logo=rust)](crates/)
[![AI Manifesto](https://img.shields.io/badge/Rules-AI_CANONICAL_MANIFESTO-red?style=for-the-badge&logo=codeforces)](MANIFEST_CANONICAL_AI_DEVELOPER.md)
[![Auditor Grok](https://img.shields.io/badge/Auditor-Grok_(Гриша)-blue?style=for-the-badge&logo=x)](GREETINGS_TO_GROK.md)
[![Dev Log](https://img.shields.io/badge/Dev_Log-ACTIVE-teal?style=for-the-badge&logo=git)](DEVELOPMENT_LOG.md)
[![Roadmap 2026](https://img.shields.io/badge/Roadmap-PQC_Kernel_DePIN_2026-brightgreen?style=for-the-badge)](docs/RUST_EVOLUTION_ROADMAP_2026.md)
[![Rust Audit](https://img.shields.io/badge/Audit-PASSED_Tier--1-success?style=for-the-badge&logo=shield)](RUST_AUDIT.md)
[![Evolution Plan](https://img.shields.io/badge/Evolution-RUST_PLAN_2026-blueviolet?style=for-the-badge)](RUST_EVOLUTION_PLAN.md)
[![Legacy Archive](https://img.shields.io/badge/Legacy-Archived_Node.js-grey?style=for-the-badge)](legacy/)
[![Wire Protocol](https://img.shields.io/badge/Wire_Protocol-v2.0.0_Big--Endian-06b6d4?style=for-the-badge&logo=wireguard)](PROTOCOL_WIRE_SPEC.md)
[![Zero-Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge_ChaCha20--Poly1305-10b981?style=for-the-badge&logo=shield)](PROTOCOL_WIRE_SPEC.md)
[![Erasure Coding](https://img.shields.io/badge/Fault_Tolerance-Reed--Solomon_(4+2)_GF(2^8)-f59e0b?style=for-the-badge&logo=speedtest)](test/protocol.test.ts)
[![Golden Vectors](https://img.shields.io/badge/Golden_Vectors-113%2F113_PASS-8b5cf6?style=for-the-badge&logo=checkmarx)](nexxus-vectors/)
[![Tor Onion](https://img.shields.io/badge/Transport-Tor_v3_Onion_P2P-ec4899?style=for-the-badge&logo=torproject)](PROTOCOL_WIRE_SPEC.md)
[![Linux Installer](https://img.shields.io/badge/Linux_Deploy-Ubuntu_One--Liner-E95420?style=for-the-badge&logo=ubuntu)](install.sh)
[![Windows Installer](https://img.shields.io/badge/Windows_Deploy-PowerShell_One--Liner-0078D6?style=for-the-badge&logo=windows)](install.ps1)
[![Android Installer](https://img.shields.io/badge/Android_Deploy-Termux_One--Liner-3DDC84?style=for-the-badge&logo=android)](scripts/install-android-termux.sh)

---

## 📑 Table of Contents

1. [Manifesto & Core Principles](#-manifesto)
2. [Architecture & Reliability Mathematics](#-architecture--reliability-mathematics)
3. [⚡ Quick Install on Linux (Ubuntu/Debian) via Single Command](#-quick-install-on-linux-ubuntudebian-via-single-command)
4. [🪟 Quick Install on Windows via Single Command](#-quick-install-on-windows-via-single-command)
5. [📱 Quick Install on Android (Termux)](#-quick-install-on-android-termux)
6. [📦 Pre-built Installation Packages (.deb, .tar.gz, .zip)](#-pre-built-installation-packages)
7. [🛠️ Complete CLI Command Reference (`nexxusd`)](#️-complete-cli-command-reference-nexxusd)
8. [⚙️ Configuration & Environment Variables](#️-configuration--environment-variables)
9. [🌐 Multi-Host Mesh Cluster Guide](#-multi-host-mesh-cluster-guide)
10. [📈 3-Year Market Economics & DePIN Model (2026–2029)](#-3-year-market-economics--depin-model-20262029)
11. [❓ FAQ & Troubleshooting](#-faq--troubleshooting)

---

## ⚡ Manifesto

Centralized cloud vendors (AWS S3, Google Cloud, Microsoft Azure, Dropbox) introduce critical systemic risks:
* **Single Point of Failure (SPOF)**: data center outages, policy changes, sudden account bans, or geopolitical sanctions instantly lock you out of your secrets.
* **The Privacy Illusion**: IP addresses, timestamps, file sizes, and query patterns are logged, indexed, and analyzed by surveillance algorithms.
* **Jurisdictional Vulnerability**: secret search warrants, subpoenas, and corporate backdoors bypass traditional security promises.

**NeXXUs replaces corporate servers with pure mathematics and a decentralized swarm.** Your files are never stored in their entirety on any single computer on Earth. They are sliced into micro-blocks of exactly 16 KB, encrypted locally with **ChaCha20-Poly1305 (Zero-Knowledge)**, encoded using fault-tolerant **Reed-Solomon (4+2)** Galois Field matrices, and scattered across a global swarm of independent nodes via the **Tor v3 Onion** anonymous network.

---

## 🏛️ Architecture & Reliability Mathematics

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                         YOUR DEVICE (CLIENT)                           │
   │  1. Authentication: Master BIP-39 Mnemonic (12/24 words)               │
   │  2. Quantization: Micro-chunks of strictly 16 KB (16,384 bytes)        │
   │  3. Local Encryption: ChaCha20-Poly1305 (AEAD, 256-bit, RFC 8439)      │
   │  4. Erasure Coding: Reed-Solomon (4+2) over Galois Field GF(2^8)       │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
               Shards 1-6 (4 data + 2 parity of 4 KB each)
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                       DECENTRALIZED P2P SWARM                          │
   │  • Anonymous Transport: Tor v3 Onion (62-char addresses)               │
   │  • Kademlia 256-bit DHT with XOR-distance routing                      │
   │  • Anti-Outsource: NVMe disk I/O verification latency (< 50 ms)        │
   │  • Anti-Monopoly: ASN Herfindahl-Hirschman Index (HHI ≤ 2500)          │
   │  • Autonomous Self-Healing upon loss of any 2 nodes                    │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   [Node #1: 4KB] [Node #2: 4KB] [Node #3: 4KB] [Node #4: 4KB] [Node #5: 4KB]
     (Germany)       (Brazil)       (Iceland)        (Japan)        (Canada)
```

### 1. Quantization & Reed-Solomon (4+2) Erasure Coding
* **Chunk size**: strictly `16,384 bytes` (16 KB).
* **Vandermonde Matrix over $GF(2^8)$** with primitive polynomial `0x11D` ($x^8 + x^4 + x^3 + x^2 + 1$).
* Each chunk splits into **4 data shards** and **2 parity shards** (4,096 bytes each).
* **Mathematical guarantee**: any 4 of the 6 shards are sufficient to reconstruct the original block bit-for-bit. Even if two host servers are simultaneously destroyed, your data is 100% recovered.

### 2. Client-Side Zero-Knowledge Encryption (ChaCha20-Poly1305)
* Data is encrypted **on your local device prior to network dispatch**.
* Symmetric cipher **ChaCha20** with 256-bit key and **Poly1305** message authentication code (RFC 8439).
* Storage nodes see only cryptographic high-entropy white noise. Node operators cannot determine file names, types, or contents.

### 3. Proof-of-Retrievability (PoR) Continuous Auditing
* The swarm continuously challenges storage nodes with random cryptographic nonces: $s \in \{0, 1\}^{256}$.
* Strict response deadline: **3,000 ms** (actual NVMe local disk response: 1–4 ms).
* Outsource cheat attempts (e.g. proxying to slow cloud storage like AWS S3 Glacier) breach latency limits, resulting in instant node slashing and bond forfeiture.

---

## ⚡ Quick Install on Linux (Ubuntu/Debian) via Single Command

Deploy a sovereign hosting node on Ubuntu (20.04, 22.04, 24.04 LTS) or Debian with **one single command**:

### 🚀 Method 1: Remote One-Liner via `curl | bash` (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.sh | bash
```

> 💡 **What the installer automates:**
> 1. Validates `sudo` privileges and system resources (CPU, RAM, disk).
> 2. Automatically installs the Rust toolchain (cargo) via rustup if missing.
> 3. Clones or updates the repository to `/opt/nexxus`.
> 4. Compiles the high-performance native Rust daemon `nexxusd` via `cargo build --release`.
> 5. Configures the global binary command `/usr/local/bin/nexxusd`.
> 6. Creates the storage directory tree `/var/lib/nexxus` (`chunks/`, `meta/`, `logs/`).
> 7. Applies Linux kernel NVMe I/O tuning via `/etc/sysctl.d/99-nexxus.conf`.
> 8. Generates the sovereign cryptographic identity (`node_identity.json`) with Ed25519 keys and **Tor Onion v3** address.
> 9. Registers and starts the background **systemd** service (`nexxus-node.service`) with auto-start on boot.

#### Install with Custom Parameters:
```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.sh | bash -s -- --storage-gb=500 --port=3999 --peers=192.168.1.10:3999
```

### 📦 Method 2: Native Debian Package (.deb)
```bash
wget https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/public/packages/nexxus-node_latest_amd64.deb
sudo dpkg -i nexxus-node_latest_amd64.deb || sudo apt-get install -f -y
nexxusd init
sudo systemctl enable --now nexxus-node
```

### 🔨 Method 3: Local Git Repository Clone
```bash
git clone https://github.com/PerfectFriend/NeXXus-Node.git
cd NeXXus-Node
sudo bash install.sh
```

---

## 🪟 Quick Install on Windows via Single Command

For Windows 10/11 machines, an automated PowerShell installer and batch control scripts are provided.

### 🚀 Method 1: PowerShell One-Liner (Recommended)

Open **PowerShell as Administrator** and run:

```powershell
irm https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.ps1 | iex
```

### 🖱️ Method 2: Double-Click `install.bat` (From Local Repo or ZIP)
If you downloaded the Windows ZIP release or cloned the repository:
1. Right-click `install.bat` and select **"Run as administrator"**.
2. The batch script bypasses PowerShell execution policies, ensures Rust toolchain is available, builds the native daemon, and registers the node.

### 🎮 Windows Management Scripts:
* `nexxus-start.bat`: Starts the P2P daemon interactively or in the background.
* `nexxus-stop.bat`: Gracefully stops all active NeXXUs daemon processes.
* `nexxusd status`: Inspects local node status, allocated NVMe storage, and Tor identity.
* `nexxusd test-por`: Runs a local Proof-of-Retrievability challenge benchmark.

---

## 📱 Quick Install on Android (Termux)

Turn any Android smartphone with fast UFS internal storage into a 24/7 sovereign P2P hosting node.

Open the **Termux** application on your device and run:

```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/scripts/install-android-termux.sh | bash
```

* **Wakelock**: Automatically activates `termux-wake-lock` to keep the CPU awake with screen locked.
* **Auto-Boot**: Fully integrates with `Termux:Boot` to automatically start the daemon when phone reboots.

---

## 📦 Pre-built Installation Packages

Ready-to-install distributions are available in `public/packages/`:

| Platform | Format | Direct Download Link | Purpose |
|---|---|---|---|
| **Ubuntu / Debian** | `.deb` | [`nexxus-node_latest_amd64.deb`](public/packages/nexxus-node_latest_amd64.deb) | Native Debian package for `dpkg -i` |
| **Universal Linux** | `.tar.gz` | [`nexxus-node_latest_linux_x86_64.tar.gz`](public/packages/nexxus-node_latest_linux_x86_64.tar.gz) | Standalone tarball for Arch, Fedora, Alpine, etc. |
| **Windows 10/11** | `.zip` | [`nexxus-node_latest_windows_x64.zip`](public/packages/nexxus-node_latest_windows_x64.zip) | Portable bundle with `install.bat`, start/stop scripts |

---

## 🛠️ Complete CLI Command Reference (`nexxusd`)

The native Rust daemon (`nexxusd`) provides commands for server operation, storage management, and diagnostics:

| Command | Description | Example |
|---|---|---|
| `nexxusd serve` | Starts dual-port daemon: WebSocket bridge + P2P TCP wire reactor | `nexxusd serve --bind 127.0.0.1:3999 --p2p-bind 127.0.0.1:4000 --storage-dir /var/lib/nexxus` |
| `nexxusd status` | Inspects node status, hardware SIMD profile, Tor v3 identity, and memory | `nexxusd status` |
| `nexxusd peer-dial` | Live TCP P2P handshake (Ping/Pong) with remote node | `nexxusd peer-dial --addr 127.0.0.1:4000` |
| `nexxusd benchmark` | Real 16KB NVMe IOPS benchmark and Reed-Solomon encode/decode throughput | `nexxusd benchmark` |
| `nexxusd por-challenge` | Runs a single Proof-of-Retrievability (PoR) 16KB Merkle audit challenge | `nexxusd por-challenge` |
| `nexxusd p2p` | Inspects Kademlia DHT routing table and topology `[SIM/in-memory]` | `nexxusd p2p` |
| `nexxusd self-healing` | Simulates autonomous mesh self-healing and ASN HHI routing | `nexxusd self-healing` |
| `nexxusd zk-por` | Generates and verifies Zero-Knowledge PoR proof (Schnorr-Pedersen) | `nexxusd zk-por` |
| `nexxusd pqc-test` | Post-Quantum Cryptography: ML-KEM Kyber-768 + X25519 hybrid roundtrip `[SIM]` | `nexxusd pqc-test` |
| `nexxusd snark-por` | Generates 384-byte succinct ZK-SNARK PoR proof (Plonk/Halo2) `[SIM]` | `nexxusd snark-por` |
| `nexxusd xdp-gen` | Generates Linux eBPF / XDP driver-level packet filter C code `[SIM]` | `nexxusd xdp-gen` |
| `nexxusd ioring-sqpoll`| Benchmarks Linux io_uring SQPOLL zero-syscall NVMe queue simulator `[SIM]` | `nexxusd ioring-sqpoll` |
| `nexxusd formal-verify`| Executes mathematical formal verification of all 15 RS 4+2 submatrices | `nexxusd formal-verify` |
| `nexxusd direct-io` | Tests 4096-byte page-aligned memory buffer for O_DIRECT NVMe DMA | `nexxusd direct-io` |
| `nexxusd depin-barter` | Autonomous DePIN State Channels & Micropayment Barter Ledger | `nexxusd depin-barter` |
| `nexxusd put` | Stores a file in CAS with RS(4+2) erasure coding and generates a manifest | `nexxusd put ./myfile.bin -s /var/lib/nexxus --peers 192.168.1.20:4000` |
| `nexxusd get` | Reconstructs a file from its manifest ID using RS(4+2) decoding | `nexxusd get <manifest_id> -o ./recovered.bin --peers 192.168.1.20:4000` |
| `nexxusd repair` | Reconstructs missing RS shards and restores file health | `nexxusd repair <manifest_id> -s /var/lib/nexxus --peers 192.168.1.20:4000` |

---

## 🗄️ Storage Layout & Dual Ports

Each NeXXUs node operates on two network ports and stores data in a dedicated directory:

### Network Ports:
* **Port `3999` (WebSocket Bridge)**: Serves JSON-RPC telemetry and real-time dashboard events for local UI dashboards and monitoring tools.
* **Port `4000` (P2P TCP Wire Reactor)**: High-performance binary wire protocol framing (`NEXX` magic bytes, Big-Endian layout, CRC32 verification) for inter-node P2P chunk transfer, PoR auditing, and DePIN voucher settlements.

### Storage Layout (`/var/lib/nexxus/`):
* `node_identity.json` — Persistent Ed25519 node passport, public key, and derived Tor v3 onion address.
* `depin_state.json` — Persistent DePIN micropayment barter ledger, state channel commitments, and peer reputation scores.
* `chunks/` — Content-Addressed Storage (CAS) directory storing immutable 16 KB chunk files named by their SHA-256 hash (`chunks/<hash>`).
* `shards/` — CAS directory for 4096-byte RS erasure-coded shard payloads (`shards/<sha256>`).
* `manifests/` — JSON file manifests mapping original files to their RS-encoded shard hashes (`manifests/<manifest_id>.json`).
* `section_XXXX.sec` — Zero-fragmentation preallocated 16 GB barter section files managed via O_DIRECT page-aligned DMA.

---

## 🌐 P2P Mesh Quickstart (Multi-Node Setup)

You can run two autonomous NeXXUs storage nodes on a single machine (or across separate LAN/WAN hosts) to verify end-to-end P2P mesh communication:

### Step 1: Start Node 1 (Bootstrap Node)
```bash
nexxusd serve \
  --bind 127.0.0.1:3999 \
  --p2p-bind 127.0.0.1:4000 \
  --storage-dir /tmp/nexxus_node1
```

### Step 2: Start Node 2 (Peer Node in another terminal)
```bash
nexxusd serve \
  --bind 127.0.0.1:4001 \
  --p2p-bind 127.0.0.1:4002 \
  --storage-dir /tmp/nexxus_node2
```

### Step 3: Dial Node 1 from Node 2 (or CLI)
```bash
nexxusd peer-dial --addr 127.0.0.1:4000
```

Output:
```
🌐 Dialing NeXXUs P2P node at 127.0.0.1:4000...
✅ Received P2P response: opcode=Pong, req_id=1
• Handshake: SUCCESSFUL (Roundtrip Pong verified)
• Payload:   "CLI_PEER_DIAL_PING"
```
### Step 4: Distribute a File into the Mesh (`put --peers`)
```bash
nexxusd put /tmp/secret_keys.tar.gz \
  -s /tmp/nexxus_node1 \
  --peers 127.0.0.1:4002
```

Output:
```
📦 File successfully ingested into NeXXUs CAS:
• File Name:     secret_keys.tar.gz
• Size:          35000 bytes
• Chunks:        3 (16 KB each)
• RS Scheme:     RS(4+2) -> 18 total shards stored
• Manifest ID:   4b8d7...
🌐 Remote Distribution: 18 shards distributed to 1 peer(s)
```

### Step 5: Retrieve or Repair Shards via Mesh Fallback
Even if Node 1 suffers local storage loss or corruption:
```bash
# Fallback retrieval using remote peers:
nexxusd get 4b8d7... -o /tmp/restored.tar.gz -s /tmp/nexxus_node1 --peers 127.0.0.1:4002

# Restore all missing shards to local CAS:
nexxusd repair 4b8d7... -s /tmp/nexxus_node1 --peers 127.0.0.1:4002
```

---

## 📁 File Put / Get & Manifest Format (Sprint 1)

NeXXUs implements a complete local file-to-CAS pipeline with Reed-Solomon erasure coding:

### Storing a File (`put`)

```bash
nexxusd put ./document.pdf -s /var/lib/nexxus
```

Output:
```
📦 File successfully ingested into NeXXUs CAS:
• File Name:     document.pdf
• Size:          51200 bytes (50.00 KB)
• Chunks:        4 (16 KB each)
• RS Scheme:     RS(4+2) -> 24 total shards stored
• Manifest ID:   a1b2c3d4e5f6...
• Manifest Path: "/var/lib/nexxus/manifests/a1b2c3d4e5f6....json"
```

Pipeline: `file → 16KB chunks → zero-pad tail → RS(4+2) encode → 6 shards (4KB each) → CAS store → manifest JSON`.

### Retrieving a File (`get`)

```bash
nexxusd get a1b2c3d4e5f6... -o ./recovered.pdf -s /var/lib/nexxus
```

Pipeline: `manifest → fetch ≥4 shards per chunk → RS reconstruct → strip tail padding → bit-for-bit original`.

RS(4+2) tolerates loss of **any 2 out of 6** shards per chunk. If 3+ shards are lost (below quorum of 4), reconstruction fails with `QuorumFailure`.

### Manifest Format (JSON)

```json
{
  "version": 1,
  "file_name": "document.pdf",
  "file_size": 51200,
  "chunk_count": 4,
  "rs_data": 4,
  "rs_total": 6,
  "original_tail_len": 2048,
  "chunks": [
    {
      "index": 0,
      "chunk_sha256": "hex...",
      "shard_hashes": [
        { "index": 0, "is_parity": false, "hash": "hex..." },
        { "index": 1, "is_parity": false, "hash": "hex..." },
        { "index": 2, "is_parity": false, "hash": "hex..." },
        { "index": 3, "is_parity": false, "hash": "hex..." },
        { "index": 4, "is_parity": true,  "hash": "hex..." },
        { "index": 5, "is_parity": true,  "hash": "hex..." }
      ]
    }
  ]
}
```

- `manifest_id` = SHA-256 of the canonical JSON serialization
- `original_tail_len` = byte count of the last chunk before zero-padding (for exact reconstruction)
- Each `shard_hashes[].hash` is the SHA-256 CAS key of the 4096-byte shard blob

---

## 📈 3-Year Market Economics & DePIN Model (2026–2029)

Full market forecast and tokenomics whitepaper: 👉 [docs/MARKET_FORECAST_AND_TOKENOMICS_3Y.md](docs/MARKET_FORECAST_AND_TOKENOMICS_3Y.md)

* **Second Life for 5.3 Billion Idle Smartphones**: UN/ITU estimates over 5.3B working smartphones sit idle in drawers worldwide. Plugged into home Wi-Fi, they consume merely 1.5 W and act as indestructible storage nodes with built-in battery backup (free UPS).
* **Anti-Loop Sybil Resistance Invariant**: $\text{Fee}_{\text{writer}} (1.30) > \text{Reward}_{\text{storer}} (1.25)$. Self-dealing data storage incurs a strictly negative yield of $-0.05$ NEXX per cycle, mathematically neutralizing farming attacks.

---

## ❓ FAQ & Troubleshooting

#### How do I open the port on Linux UFW firewall?
```bash
sudo ufw allow 3999/tcp comment "NeXXUs P2P Wire Protocol"
sudo ufw reload
```

#### Do I need a public static IP address?
A public IP is useful for direct peering, but **not required**. NeXXUs features native **Tor v3 (.onion)** hidden service routing, automatically bypassing NAT and firewalls without router configuration.

#### How do I migrate my node to a new server?
Securely save the 12-word mnemonic phrase generated during `nexxusd init`. On any new server, run:
```bash
nexxusd init --mnemonic="your twelve mnemonic words go here..."
```

---

<p align="center">
  <b>Engineered for free, sovereign, and indestructible data custody.</b><br>
  <sub>NeXXUs Protocol Core • Version 2.0.0</sub>
</p>
