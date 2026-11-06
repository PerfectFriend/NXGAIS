#!/usr/bin/env bash
set -e

# ==============================================================================
# NeXXUs Protocol - Debian / Ubuntu (.deb) Package Builder
# Architecture: amd64
# Target: Ubuntu 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

VERSION="2.0.0"
PKG_NAME="nexxus-node"
ARCH="amd64"
BUILD_DIR="dist/pkg-staging/${PKG_NAME}_${VERSION}_${ARCH}"
DEB_FILE="dist/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo "=========================================================="
echo "📦 Building Debian/Ubuntu Package: ${PKG_NAME}_${VERSION}_${ARCH}.deb"
echo "=========================================================="

# 1. Compile standalone Node.js bundle with esbuild
echo "⚡ [1/5] Bundling standalone executable via esbuild..."
mkdir -p dist
npx esbuild scripts/linux-daemon.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=dist/nexxusd.cjs
chmod +x dist/nexxusd.cjs

# 2. Prepare Debian filesystem staging tree
echo "📁 [2/5] Creating Debian package tree structure..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/DEBIAN"
mkdir -p "$BUILD_DIR/usr/bin"
mkdir -p "$BUILD_DIR/usr/lib/nexxus"
mkdir -p "$BUILD_DIR/etc/nexxus"
mkdir -p "$BUILD_DIR/etc/systemd/system"
mkdir -p "$BUILD_DIR/var/lib/nexxus/chunks"
mkdir -p "$BUILD_DIR/var/lib/nexxus/meta"
mkdir -p "$BUILD_DIR/var/lib/nexxus/logs"

# 3. Copy binary and configuration files
echo "📄 [3/5] Installing daemon bundle & wrapper script..."
cp dist/nexxusd.cjs "$BUILD_DIR/usr/lib/nexxus/nexxusd.cjs"
chmod 755 "$BUILD_DIR/usr/lib/nexxus/nexxusd.cjs"

# Create /usr/bin/nexxusd wrapper that explicitly executes node on /usr/lib/nexxus/nexxusd.cjs
cat <<'EOF' > "$BUILD_DIR/usr/bin/nexxusd"
#!/bin/sh
# NeXXUs Protocol - Global CLI Launcher
exec node /usr/lib/nexxus/nexxusd.cjs "$@"
EOF
chmod 755 "$BUILD_DIR/usr/bin/nexxusd"

cat <<'EOF' > "$BUILD_DIR/etc/nexxus/nexxus.conf"
# ==============================================================================
# NeXXUs Storage Node Daemon Configuration
# /etc/nexxus/nexxus.conf
# ==============================================================================

# Total dedicated storage pool in GB (384 GB = 24 sections of 16GB)
NEXXUS_STORAGE_GB=384

# Listen network host (0.0.0.0 listens on all interfaces: LAN + WAN)
NEXXUS_HOST=0.0.0.0

# TCP / WebSocket P2P Port
NEXXUS_PORT=3999

# Primary persistent data directory
NEXXUS_DATA_DIR=/var/lib/nexxus

# Minimum log level (DEBUG, INFO, WARN, ERROR)
NEXXUS_LOG_LEVEL=INFO

# Bootstrap peers (comma separated list of IP:PORT or hostnames)
# Example for testing between 2 Ubuntu hosts:
# NEXXUS_BOOTSTRAP_PEERS=192.168.1.20:3999
NEXXUS_BOOTSTRAP_PEERS=
EOF
chmod 644 "$BUILD_DIR/etc/nexxus/nexxus.conf"

cat <<'EOF' > "$BUILD_DIR/etc/systemd/system/nexxus-node.service"
[Unit]
Description=NeXXUs Sovereign P2P Decentralized Storage Daemon
Documentation=https://nexxus.network
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nexxus
Group=nexxus
EnvironmentFile=-/etc/nexxus/nexxus.conf
ExecStart=/usr/bin/nexxusd serve
Restart=always
RestartSec=3s
LimitNOFILE=1048576
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nexxusd

# Linux Security Sandboxing
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
chmod 644 "$BUILD_DIR/etc/systemd/system/nexxus-node.service"

# 4. Generate Debian Control & Maintenance Scripts
echo "📝 [4/5] Generating DEBIAN control metadata..."

cat <<EOF > "$BUILD_DIR/DEBIAN/control"
Package: ${PKG_NAME}
Version: ${VERSION}
Section: net
Priority: optional
Architecture: ${ARCH}
Recommends: nodejs (>= 18.0.0)
Suggests: tor
Maintainer: NeXXUs Protocol Core <core@nexxus.network>
Description: NeXXUs Sovereign P2P Storage Daemon for Ubuntu Linux
 Standalone decentralized storage node daemon featuring 16GB allocation
 sections, 16KB encrypted chunk storage (ChaCha20-Poly1305), Reed-Solomon
 (4+2) Galois Field GF(2^8) erasure coding, Merkle Proof-of-Retrievability
 audits (<3000ms), and Kademlia DHT Sybil-resistant mesh routing.
EOF

cat <<'EOF' > "$BUILD_DIR/DEBIAN/postinst"
#!/bin/sh
set -e

# Verify Node.js runtime presence
if ! command -v node >/dev/null 2>&1; then
    echo "⚠️  [WARNING] Node.js is not found in PATH!"
    echo "    Please install Node.js LTS (>= 18.0.0):"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
    echo "    sudo apt-get install -y nodejs"
fi

# Create nexxus system group and user if they do not exist
if ! getent group nexxus >/dev/null 2>&1; then
    groupadd --system nexxus
fi

if ! getent passwd nexxus >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/nexxus --shell /bin/false --gid nexxus nexxus
fi

# Set directory permissions
mkdir -p /var/lib/nexxus/chunks /var/lib/nexxus/meta /var/lib/nexxus/logs
chown -R nexxus:nexxus /var/lib/nexxus
chmod 750 /var/lib/nexxus

# Reload systemd
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload || true
    echo "=========================================================="
    echo "✅ NeXXUs Node Daemon (${PKG_NAME}) installed successfully!"
    echo "=========================================================="
    echo "To configure bootstrap peers & storage allocation:"
    echo "  sudo nano /etc/nexxus/nexxus.conf"
    echo ""
    echo "To start and enable the daemon on boot:"
    echo "  sudo systemctl enable --now nexxus-node"
    echo ""
    echo "To view live real-time logs:"
    echo "  journalctl -u nexxus-node -f"
    echo "  # or: nexxusd logs"
    echo ""
    echo "To test inter-host connectivity against another Ubuntu host:"
    echo "  nexxusd test-interhost <target_ip>:3999"
    echo "=========================================================="
fi

exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postinst"

cat <<'EOF' > "$BUILD_DIR/DEBIAN/prerm"
#!/bin/sh
set -e

if [ -d /run/systemd/system ]; then
    systemctl stop nexxus-node 2>/dev/null || true
    systemctl disable nexxus-node 2>/dev/null || true
fi

exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/prerm"

# 5. Build .deb package using dpkg-deb
echo "📦 [5/5] Packaging binary into Debian archive..."
dpkg-deb --build --root-owner-group "$BUILD_DIR" "$DEB_FILE"

# Also copy to public directory for direct browser download
mkdir -p public/packages
cp "$DEB_FILE" "public/packages/nexxus-node_latest_amd64.deb"
cp "$DEB_FILE" "public/nexxus-node_2.0.0_amd64.deb"

echo "=========================================================="
echo "🎉 Package Built Successfully!"
echo "DEB File: $DEB_FILE ($(du -h "$DEB_FILE" | cut -f1))"
echo "Public:   public/packages/nexxus-node_latest_amd64.deb"
echo "Install Command:"
echo "  sudo dpkg -i $DEB_FILE"
echo "=========================================================="
