#!/usr/bin/env bash
set -e

# ==============================================================================
# NeXXUs Protocol - RedHat / Fedora / CentOS (.rpm) & Linux Tarball Package Builder
# Architecture: x86_64
# ==============================================================================

VERSION="2.0.0"
PKG_NAME="nexxus-node"
ARCH="x86_64"
DIST_DIR="dist"
STAGE_DIR="dist/rpm-staging"
RPM_SPEC="$STAGE_DIR/SPECS/nexxus-node.spec"
TAR_FILE="$DIST_DIR/${PKG_NAME}_${VERSION}_linux_${ARCH}.tar.gz"

echo "=========================================================="
echo "📦 Building Linux Distribution Packages: $PKG_NAME v$VERSION ($ARCH)"
echo "=========================================================="

# 1. Compile standalone Node.js daemon bundle with esbuild
mkdir -p "$DIST_DIR"
if [ ! -f "$DIST_DIR/nexxusd.cjs" ]; then
  echo "⚡ [1/4] Bundling standalone executable via esbuild..."
  npx esbuild scripts/linux-daemon.ts \
    --bundle \
    --platform=node \
    --format=cjs \
    --outfile="$DIST_DIR/nexxusd.cjs"
fi
chmod +x "$DIST_DIR/nexxusd.cjs"

# 2. Build Universal Linux Binary Tarball
echo "📦 [2/4] Creating Universal Linux Tarball (${TAR_FILE})..."
TAR_STAGE="$DIST_DIR/tar-staging/nexxus-node"
rm -rf "$TAR_STAGE"
mkdir -p "$TAR_STAGE/bin" "$TAR_STAGE/config" "$TAR_STAGE/systemd"

cp "$DIST_DIR/nexxusd.cjs" "$TAR_STAGE/bin/nexxusd"
chmod +x "$TAR_STAGE/bin/nexxusd"
cp install.sh "$TAR_STAGE/install.sh"
chmod +x "$TAR_STAGE/install.sh"
cp scripts/nexxus-node.service "$TAR_STAGE/systemd/" 2>/dev/null || true

cat <<'EOF' > "$TAR_STAGE/config/nexxus.conf"
# NeXXUs Storage Node Daemon Configuration
NEXXUS_STORAGE_GB=384
NEXXUS_HOST=0.0.0.0
NEXXUS_PORT=3999
NEXXUS_DATA_DIR=/var/lib/nexxus
NEXXUS_LOG_LEVEL=INFO
NEXXUS_BOOTSTRAP_PEERS=
EOF

tar -czf "$TAR_FILE" -C "$DIST_DIR/tar-staging" nexxus-node
rm -rf "$DIST_DIR/tar-staging"
echo "✅ Created: $TAR_FILE"

# 3. Create RPM Spec File and Package if rpmbuild is available
echo "📝 [3/4] Generating RPM Spec and Package Tree..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/BUILD" "$STAGE_DIR/RPMS" "$STAGE_DIR/SOURCES" "$STAGE_DIR/SPECS" "$STAGE_DIR/SRPMS"

cat <<EOF > "$RPM_SPEC"
Name:           ${PKG_NAME}
Version:        ${VERSION}
Release:        1%{?dist}
Summary:        NeXXUs Sovereign P2P Decentralized Storage Daemon
License:        MIT
URL:            https://github.com/PerfectFriend/NeXXus-Node
AutoReqProv:    no

%description
NeXXUs Sovereign Node transforms standard hardware into a decentralized P2P storage node.
Features Reed-Solomon (4+2) erasure coding, ChaCha20-Poly1305 AEAD, Tor v3 onion circuits,
and Proof-of-Retrievability (PoR) verification.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/lib/nexxus
mkdir -p %{buildroot}/etc/nexxus
mkdir -p %{buildroot}/etc/systemd/system
mkdir -p %{buildroot}/var/lib/nexxus/chunks
mkdir -p %{buildroot}/var/lib/nexxus/meta
mkdir -p %{buildroot}/var/lib/nexxus/logs

cp %{_topdir}/../../dist/nexxusd.cjs %{buildroot}/usr/lib/nexxus/nexxusd.cjs
chmod 755 %{buildroot}/usr/lib/nexxus/nexxusd.cjs

cat <<'SUB_EOF' > %{buildroot}/usr/bin/nexxusd
#!/bin/sh
exec node /usr/lib/nexxus/nexxusd.cjs "\$@"
SUB_EOF
chmod 755 %{buildroot}/usr/bin/nexxusd

cat <<'SUB_EOF' > %{buildroot}/etc/nexxus/nexxus.conf
NEXXUS_STORAGE_GB=384
NEXXUS_HOST=0.0.0.0
NEXXUS_PORT=3999
NEXXUS_DATA_DIR=/var/lib/nexxus
NEXXUS_LOG_LEVEL=INFO
SUB_EOF

cat <<'SUB_EOF' > %{buildroot}/etc/systemd/system/nexxus-node.service
[Unit]
Description=NeXXUs Sovereign P2P Decentralized Storage Daemon
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
EnvironmentFile=-/etc/nexxus/nexxus.conf
ExecStart=/usr/bin/nexxusd serve
Restart=always
RestartSec=3s
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
SUB_EOF

%files
/usr/bin/nexxusd
/usr/lib/nexxus/nexxusd.cjs
%config(noreplace) /etc/nexxus/nexxus.conf
/etc/systemd/system/nexxus-node.service
%dir /var/lib/nexxus
%dir /var/lib/nexxus/chunks
%dir /var/lib/nexxus/meta
%dir /var/lib/nexxus/logs

%post
systemctl daemon-reload >/dev/null 2>&1 || true

%changelog
* Wed Oct 28 2026 PerfectFriend <alicia.babaika@gmail.com> - 2.0.0-1
- Initial production release of NeXXUs Sovereign Node
EOF

if command -v rpmbuild >/dev/null 2>&1; then
  echo "🔨 [4/4] Invoking rpmbuild..."
  rpmbuild --define "_topdir $(pwd)/$STAGE_DIR" -bb "$RPM_SPEC"
  RPM_OUT=$(find "$STAGE_DIR/RPMS" -name "*.rpm" | head -n1)
  if [ -n "$RPM_OUT" ]; then
    cp "$RPM_OUT" "$DIST_DIR/"
    echo "✅ RPM Package Created: $DIST_DIR/$(basename "$RPM_OUT")"
  fi
else
  echo "ℹ️  rpmbuild not installed on this host. Skipping .rpm generation (tarball generated)."
fi

echo "=========================================================="
echo "🎉 Package Generation Complete!"
echo "Linux Packages available in dist/:"
ls -lh "$DIST_DIR"/*.deb "$DIST_DIR"/*.tar.gz 2>/dev/null || true
echo "=========================================================="
