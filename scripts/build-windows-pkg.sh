#!/usr/bin/env bash
set -e

# ==============================================================================
# NeXXUs Protocol - Windows Distribution Package Builder (.zip)
# ==============================================================================

VERSION="2.0.0"
DIST_DIR="dist"
STAGE_DIR="dist/windows-staging"
ZIP_FILE="$DIST_DIR/nexxus-node_${VERSION}_windows_x64.zip"

echo "=========================================================="
echo "📦 Packaging Windows Distribution Archive: $ZIP_FILE"
echo "=========================================================="

mkdir -p "$DIST_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/bin"

# 1. Compile bundle if not present
if [ ! -f "$DIST_DIR/nexxusd.cjs" ]; then
  echo "⚡ Compiling nexxusd.cjs standalone bundle..."
  npx esbuild scripts/linux-daemon.ts \
    --bundle \
    --platform=node \
    --format=cjs \
    --outfile="$DIST_DIR/nexxusd.cjs"
fi

# 2. Copy Windows launchers and bundle
cp "$DIST_DIR/nexxusd.cjs" "$STAGE_DIR/bin/nexxusd.cjs"
cp install.bat "$STAGE_DIR/install.bat"
cp install.ps1 "$STAGE_DIR/install.ps1"
cp nexxus-start.bat "$STAGE_DIR/nexxus-start.bat"
cp nexxus-stop.bat "$STAGE_DIR/nexxus-stop.bat"
cp README.md "$STAGE_DIR/README.txt"

# 3. Create CMD wrapper in bin
cat <<'EOF' > "$STAGE_DIR/bin/nexxusd.cmd"
@echo off
node "%~dp0nexxusd.cjs" %*
EOF

cat <<'EOF' > "$STAGE_DIR/bin/nexxusd.ps1"
& node "$PSScriptRoot\nexxusd.cjs" $args
EOF

# 4. Create ZIP archive
python3 -c "
import shutil
shutil.make_archive('${DIST_DIR}/nexxus-node_${VERSION}_windows_x64', 'zip', '${STAGE_DIR}')
"

# Copy to public for direct web/browser download
mkdir -p public/packages
cp "$ZIP_FILE" "public/packages/nexxus-node_latest_windows_x64.zip" 2>/dev/null || true
cp "$DIST_DIR/nexxus-node_2.0.0_amd64.deb" "public/packages/nexxus-node_latest_amd64.deb" 2>/dev/null || true

echo "✅ Windows Package Created: $ZIP_FILE"
ls -lh "$ZIP_FILE"
