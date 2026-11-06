#!/usr/bin/env bash
# ==============================================================================
# 🌌 NeXXUs Sovereign Storage Node - Android (Termux) Automated Installer
#
# Quick 1-Line GitHub Installation in Termux:
#   curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/scripts/install-android-termux.sh | bash
#
# ==============================================================================

set -eo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}==========================================================${NC}"
echo -e "${BOLD}📱 NeXXUs Sovereign Node — Android Termux Installer${NC}"
echo -e "${CYAN}==========================================================${NC}"

# Check for Termux environment
if [ -z "$PREFIX" ] || [ ! -d "$PREFIX" ]; then
  echo -e "${YELLOW}⚠️ Notice: This script is optimized for Android Termux environment ($PREFIX).${NC}"
fi

REPO="PerfectFriend/NeXXus-Node"
DATA_DIR="$HOME/.nexxus-storage"
STORAGE_GB=32 # Sensible mobile storage default (32GB)
PORT=3999

# 1. Update and install dependencies
echo -e "📦 Updating packages and installing Node.js LTS, Git & OpenSSL..."
pkg update -y >/dev/null 2>&1 || true
pkg install -y nodejs-lts git openssl termux-api >/dev/null 2>&1

# 2. Acquire Termux Wake Lock (prevents Android Doze sleep)
if command -v termux-wake-lock >/dev/null 2>&1; then
  echo -e "⚡ Acquiring Termux Wake Lock to keep P2P node alive in background..."
  termux-wake-lock || true
fi

# 3. Create Storage Directories
mkdir -p "$DATA_DIR/chunks" "$DATA_DIR/meta" "$DATA_DIR/logs"

# 4. Download Standalone Node Daemon Bundle
INSTALL_DIR="$PREFIX/opt/nexxus"
mkdir -p "$INSTALL_DIR"
BUNDLE_TARGET="$INSTALL_DIR/nexxusd.cjs"

echo -e "📥 Fetching NeXXUs daemon engine from GitHub repository..."
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/dist/nexxusd.cjs" -o "$BUNDLE_TARGET" || {
  echo -e "${YELLOW}Could not fetch bundle directly. Cloning repo...${NC}"
  git clone --depth=1 "https://github.com/$REPO.git" "$HOME/nexxus-repo"
  cp "$HOME/nexxus-repo/dist/nexxusd.cjs" "$BUNDLE_TARGET"
}
chmod +x "$BUNDLE_TARGET"

# 5. Install global CLI binary in Termux bin
CLI_BIN="$PREFIX/bin/nexxusd"
cat <<EOF > "$CLI_BIN"
#!/data/data/com.termux/files/usr/bin/sh
exec node "$BUNDLE_TARGET" "\$@"
EOF
chmod 755 "$CLI_BIN"

# 6. Initialize Sovereign Identity
echo -e "🔑 Initializing sovereign Ed25519 node passport & Onion v3..."
nexxusd init --dir="$DATA_DIR"

# 7. Create Termux Boot script (if Termux:Boot is used)
BOOT_DIR="$HOME/.termux/boot"
if [ -d "$HOME/.termux" ]; then
  mkdir -p "$BOOT_DIR"
  cat <<EOF > "$BOOT_DIR/start-nexxus.sh"
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
nexxusd serve --data-dir="$DATA_DIR" --storage-gb=$STORAGE_GB --port=$PORT >> "$DATA_DIR/logs/nexxusd.log" 2>&1 &
EOF
  chmod +x "$BOOT_DIR/start-nexxus.sh"
fi

echo ""
echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}🎉 NeXXUs Storage Node Installed Successfully on Android!${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo -e "Global CLI:         ${BOLD}nexxusd${NC}"
echo -e "Data Directory:     ${BOLD}$DATA_DIR${NC}"
echo -e "Storage Allocation: ${BOLD}$STORAGE_GB GB${NC}"
echo ""
echo -e "🚀 ${BOLD}Available Commands in Termux:${NC}"
echo -e "  ${CYAN}nexxusd status${NC}                     # Check node identity and allocated pool"
echo -e "  ${CYAN}nexxusd id${NC}                         # View Ed25519 passport & Onion address"
echo -e "  ${CYAN}nexxusd serve${NC}                      # Start foreground/background daemon"
echo -e "  ${CYAN}nexxusd test-por${NC}                   # Run local Proof-of-Retrievability test"
echo -e "  ${CYAN}nexxusd peer add <UBUNTU_IP>:3999${NC}  # Join your Ubuntu mesh cluster"
echo ""
echo -e "🔋 ${BOLD}Important Android Settings:${NC}"
echo -e "  • Disable 'Battery Optimization' for Termux in Android Settings."
echo -e "  • Allow 'Background Activity' and enable Wakelock via 'termux-wake-lock'."
echo -e "${GREEN}==========================================================${NC}"
