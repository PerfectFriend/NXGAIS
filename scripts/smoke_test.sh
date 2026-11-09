#!/usr/bin/env bash
# ==============================================================================
# NeXXUs Release Candidate Smoke Test
# Audit ID: REL-SMOKE-01
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo "🧪 Running NeXXUs Release Candidate (v2.0.0-beta.1) Smoke Test"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# 1. Build release binary
echo "⚙️  1. Building nexxusd in release mode..."
cargo build -p nexxusd --release

TARGET_DIR="${CARGO_TARGET_DIR:-${ROOT_DIR}/target}"
BIN="${TARGET_DIR}/release/nexxusd"
if [ ! -x "${BIN}" ]; then
  echo "❌ Error: Release binary not found at ${BIN}"
  exit 1
fi
echo "✅ Release binary compiled successfully at ${BIN}"

# 2. Test CLI commands and help flags
echo "⚙️  2. Verifying CLI command interfaces..."
"${BIN}" --help >/dev/null
"${BIN}" put --help >/dev/null
"${BIN}" get --help >/dev/null
"${BIN}" repair --help >/dev/null
"${BIN}" challenge --help >/dev/null
"${BIN}" peers --help >/dev/null
echo "✅ CLI help interfaces verified"

# 3. Create isolated sandbox environment
TMP_DIR="$(mktemp -d -t nexxus_smoke_XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT

STORAGE_DIR="${TMP_DIR}/storage"
mkdir -p "${STORAGE_DIR}"

# 4. Check status & node identity permissions (REL-IDENTITY-KEY-01)
echo "⚙️  3. Testing nexxusd status & identity generation..."
"${BIN}" status -s "${STORAGE_DIR}" > "${TMP_DIR}/status.log"
grep -q "\[SIM\] Modules:" "${TMP_DIR}/status.log" || {
  echo "❌ Error: [SIM] modules banner missing in status output"
  exit 1
}

ID_FILE="${STORAGE_DIR}/node_identity.json"
if [ ! -f "${ID_FILE}" ]; then
  echo "❌ Error: node_identity.json not generated"
  exit 1
fi

PERMS=$(stat -c "%a" "${ID_FILE}")
if [ "${PERMS}" != "600" ]; then
  echo "❌ Error: node_identity.json has permissions ${PERMS}, expected 600"
  exit 1
fi
echo "✅ Node identity generated with permissions 0600"

# 5. Create test payload and encryption key file (REL-KEY-01)
echo "⚙️  4. Testing encrypted put / get / PoR challenge pipeline..."
TEST_FILE="${TMP_DIR}/smoke_input.dat"
KEY_FILE="${TMP_DIR}/test.key"

# Generate 45KB payload (exercises RS 4+2 across multiple 16KB chunks)
head -c 46080 /dev/urandom > "${TEST_FILE}"

# Generate 32-byte secret key file with 0600 permissions
head -c 32 /dev/urandom > "${KEY_FILE}"
chmod 600 "${KEY_FILE}"

# Ingest with encryption
PUT_OUT=$("${BIN}" put "${TEST_FILE}" -s "${STORAGE_DIR}" --key-file "${KEY_FILE}")
MANIFEST_ID=$(echo "${PUT_OUT}" | grep "Manifest ID:" | sed 's/.*Manifest ID:[[:space:]]*//')

if [ -z "${MANIFEST_ID}" ]; then
  echo "❌ Error: Failed to extract Manifest ID from put output"
  exit 1
fi
echo "✅ Ingested file into CAS: Manifest ID = ${MANIFEST_ID}"

# Run PoR challenge audit (FEAT-CHALLENGE-LOOP-01)
CHAL_OUT=$("${BIN}" challenge --manifest "${MANIFEST_ID}" -s "${STORAGE_DIR}")
echo "${CHAL_OUT}" | grep -q "PASS" || {
  echo "❌ Error: PoR challenge failed on stored shards"
  exit 1
}
echo "✅ PoR challenge passed for stored shards"

# Retrieve with key file and verify bit-for-bit identity
RECOVERED_FILE="${TMP_DIR}/smoke_recovered.dat"
"${BIN}" get "${MANIFEST_ID}" -o "${RECOVERED_FILE}" -s "${STORAGE_DIR}" --key-file "${KEY_FILE}"

if ! cmp -s "${TEST_FILE}" "${RECOVERED_FILE}"; then
  echo "❌ Error: Reconstructed file does not match original payload bit-for-bit!"
  exit 1
fi
echo "✅ File retrieved and decrypted bit-for-bit successfully"

echo "=========================================================="
echo "🎉 ALL SMOKE TESTS PASSED (NeXXUs v2.0.0-beta.1 Ready!)"
echo "=========================================================="
