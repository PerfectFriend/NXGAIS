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
> 2. Automatically installs Node.js LTS (v20) via NodeSource if missing.
> 3. Clones or updates the repository to `/opt/nexxus`.
> 4. Builds the optimized standalone daemon bundle `dist/nexxusd.cjs`.
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
2. The batch script bypasses PowerShell execution policies, installs Node.js LTS silently via `winget` (if missing), deploys the daemon, and registers the node.

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

| Command | Description | Example |
|---|---|---|
| `nexxusd serve` | Start P2P storage daemon in service/interactive mode | `nexxusd serve --port=3999` |
| `nexxusd init` | Generate sovereign cryptographic identity and Tor Onion v3 | `nexxusd init` or recover: `nexxusd init --mnemonic="..."` |
| `nexxusd id` | Display node identity, Ed25519 public key, and Onion v3 address | `nexxusd id` |
| `nexxusd status` | Inspect storage status, NVMe allocation, and vault score | `nexxusd status` |
| `nexxusd peers` | List all connected active mesh peers and RTT latencies | `nexxusd peers` |
| `nexxusd peer add <IP:PORT>` | Connect to a remote peer and perform mutual handshake | `nexxusd peer add 192.168.1.50:3999` |
| `nexxusd test-por` | Run local Proof-of-Retrievability audit benchmark (<3000 ms) | `nexxusd test-por` |
| `nexxusd test-interhost <IP:PORT>` | Run full 6-phase P2P inter-host diagnostic validation | `nexxusd test-interhost 192.168.1.50:3999` |
| `nexxusd upload <file>` | Slices local file into 16KB chunks, applies RS(4+2), and disperses | `nexxusd upload /path/to/archive.tar.gz` |
| `nexxusd download <hash> <out>` | Fetches shards from swarm, recovers via RS, and decrypts | `nexxusd download <sha256> /tmp/restored.bin` |
| `nexxusd logs [-n N]` | View structured operation log entries | `nexxusd logs -n 50` |
| `nexxusd benchmark` | Test local NVMe read/write speed and Merkle tree calculation | `nexxusd benchmark` |

---

## ⚙️ Configuration & Environment Variables

Main configuration file: `/etc/nexxus/nexxus.conf` (or `nexxus.conf` in the program folder):

```ini
# Network interface and listening port
NEXXUS_HOST=0.0.0.0
NEXXUS_PORT=3999

# Data directory and allocated NVMe storage pool (in GB)
NEXXUS_DATA_DIR=/var/lib/nexxus
NEXXUS_STORAGE_GB=384

# Reed-Solomon Fault-Tolerance Parameters
NEXXUS_REED_SOLOMON_DATA=4
NEXXUS_REED_SOLOMON_PARITY=2
NEXXUS_CHUNK_SIZE_KB=16

# Bootstrap seed nodes (comma separated)
NEXXUS_BOOTSTRAP_PEERS=192.168.1.10:3999,192.168.1.20:3999

# Logging verbosity (debug, info, warn, error)
NEXXUS_LOG_LEVEL=info
```

---

## 🌐 Multi-Host Mesh Cluster Guide

1. Install NeXXUs on **Host 1** (`192.168.1.10`) and **Host 2** (`192.168.1.20`).
2. On **Host 1**, peer with **Host 2**:
   ```bash
   nexxusd peer add 192.168.1.20:3999
   ```
3. Run the automated 6-in-1 inter-host validation test:
   ```bash
   nexxusd test-interhost 192.168.1.20:3999
   ```
4. Upload confidential files to the mesh:
   ```bash
   nexxusd upload /tmp/secret_keys.tar.gz
   ```

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
