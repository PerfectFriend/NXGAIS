#!/usr/bin/env bash
set -e

# ==============================================================================
# NeXXUs Storage Node - Ubuntu Linux Automated Installer
# Target Architecture: x86_64 / amd64 (Ubuntu 20.04, 22.04, 24.04 LTS)
# Hardware Profile: Beelink SER9 (AMD Ryzen AI 9, 24GB RAM, 500GB NVMe SSD)
# Features: 16GB Allocation Sections, ChaCha20-Poly1305, Reed-Solomon (4+2),
#           Sub-second PoR Merkle Audits, Systemd Daemon, Multi-Host P2P Wire.
# ==============================================================================

echo "=========================================================="
echo "🐧 NeXXUs Sovereign Node Installer for Ubuntu Linux"
echo "=========================================================="

if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
  echo "ℹ️ Running with sudo privileges..."
else
  SUDO=""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEB_PACKAGE="$PROJECT_ROOT/dist/nexxus-node_2.0.0_amd64.deb"

# Mode A: If pre-built Debian package is present, offer clean dpkg installation
if [ -f "$DEB_PACKAGE" ] && [ "$1" != "--from-source" ]; then
  echo "📦 Found pre-built Debian package: $DEB_PACKAGE"
  echo "🚀 Installing via dpkg system package manager..."

  # Check Node.js dependency
  if ! command -v node &> /dev/null; then
    echo "⚡ Installing Node.js LTS via NodeSource..."
    $SUDO apt-get update -y
    $SUDO apt-get install -y curl gnupg build-essential
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO apt-get install -y nodejs
  fi

  $SUDO dpkg -i "$DEB_PACKAGE" || $SUDO apt-get install -f -y
  
  echo ""
  echo "=========================================================="
  echo "🎉 Installation complete via Debian Package!"
  echo "Binary location:    /usr/bin/nexxusd"
  echo "Configuration:      /etc/nexxus/nexxus.conf"
  echo "Data directory:     /var/lib/nexxus"
  echo "Logs location:      /var/lib/nexxus/logs/nexxusd.log"
  echo ""
  echo "Useful commands:"
  echo "  nexxusd status"
  echo "  nexxusd test-por"
  echo "  nexxusd test-interhost <peer_ip>:3999"
  echo "  nexxusd logs -n 50"
  echo "  sudo systemctl enable --now nexxus-node"
  echo "=========================================================="
  exit 0
fi

# Mode B: Install from source / repository
echo "🔧 Installing from source tree ($PROJECT_ROOT)..."

# 1. Hardware Detection
CPU_MODEL=$(grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Generic x86_64")
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))
echo "Detected CPU: $CPU_MODEL"
echo "Detected RAM: ${TOTAL_MEM_GB} GB"

# 2. Check Node.js
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js LTS via NodeSource..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y curl gnupg build-essential
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y nodejs
else
  echo "✅ Node.js $(node -v) is available."
fi

# 3. Compile standalone bundle if needed
mkdir -p "$PROJECT_ROOT/dist"
if [ ! -f "$PROJECT_ROOT/dist/nexxusd.cjs" ]; then
  echo "⚡ Compiling standalone daemon bundle via esbuild..."
  cd "$PROJECT_ROOT"
  npx esbuild scripts/linux-daemon.ts --bundle --platform=node --format=cjs --outfile=dist/nexxusd.cjs
fi
chmod +x "$PROJECT_ROOT/dist/nexxusd.cjs"

# 4. Install global executable
echo "🔗 Installing global 'nexxusd' CLI binary..."
$SUDO cp "$PROJECT_ROOT/dist/nexxusd.cjs" /usr/local/bin/nexxusd
$SUDO chmod 755 /usr/local/bin/nexxusd

# 5. Storage Directory & Permissions
NEXXUS_DIR=${NEXXUS_DATA_DIR:-"/var/lib/nexxus"}
DEFAULT_GB=${NEXXUS_STORAGE_GB:-"384"}
echo "📁 Setting up storage directory at $NEXXUS_DIR ($DEFAULT_GB GB allocation)..."
$SUDO mkdir -p "$NEXXUS_DIR/chunks" "$NEXXUS_DIR/meta" "$NEXXUS_DIR/logs"
$SUDO chmod -R 755 "$NEXXUS_DIR"

# 6. Kernel Sysctl Tuning (NVMe & 24GB RAM optimization)
echo "⚡ Applying kernel sysctl optimizations for NVMe & high IOPS..."
$SUDO tee /etc/sysctl.d/99-nexxus.conf > /dev/null <<EOF
# NeXXUs Storage Node Kernel Optimizations
vm.swappiness = 10
vm.dirty_background_ratio = 5
vm.dirty_ratio = 10
fs.file-max = 2097152
net.core.somaxconn = 65535
EOF
$SUDO sysctl --system > /dev/null 2>&1 || true

# 7. Systemd Service Unit
echo "⚙️ Installing systemd service unit /etc/systemd/system/nexxus-node.service..."
$SUDO tee /etc/systemd/system/nexxus-node.service > /dev/null <<EOF
[Unit]
Description=NeXXUs Sovereign Decentralized Storage Node Daemon
Documentation=https://nexxus.network
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER:-root}
Environment=NODE_ENV=production
Environment=NEXXUS_DATA_DIR=$NEXXUS_DIR
Environment=NEXXUS_STORAGE_GB=$DEFAULT_GB
Environment=NEXXUS_PORT=3999
Environment=NEXXUS_HOST=0.0.0.0
ExecStart=/usr/local/bin/nexxusd serve
Restart=always
RestartSec=3s
LimitNOFILE=1048576
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nexxusd

# Linux Security Sandbox
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload || true

echo "=========================================================="
echo "🎉 NeXXUs Node Installed Successfully on Ubuntu!"
echo "Global Command:     nexxusd"
echo "Configuration:      $NEXXUS_DIR"
echo "Log File:           $NEXXUS_DIR/logs/nexxusd.log"
echo "Allocated Pool:     $DEFAULT_GB GB (24 x 16GB sections)"
echo ""
echo "🚀 Quick Start & Testing Commands:"
echo "  nexxusd init                       # Initialize sovereign cryptographic identity"
echo "  nexxusd id                         # Display node passport & Tor Onion v3"
echo "  nexxusd status                     # Check identity & NVMe pool"
echo "  nexxusd peers                      # View active connected mesh peers"
echo "  nexxusd peer add <IP>:3999         # Connect and exchange keys with peer"
echo "  nexxusd test-por                   # Test Proof-of-Retrievability"
echo "  nexxusd test-interhost <IP>:3999   # Run full 6-step P2P audit against peer"
echo "  nexxusd upload <file>              # Ingest real file & distribute 4+2 shards"
echo "  nexxusd download <hash> <out_path> # Fetch & reconstruct file from network"
echo "  nexxusd logs -n 50                 # View structured operational log"
echo ""
echo "To start the background daemon via systemd:"
echo "  sudo systemctl enable --now nexxus-node"
echo "=========================================================="
