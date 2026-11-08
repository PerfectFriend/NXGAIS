#!/usr/bin/env bash
set -e

TOKEN="${1:-$GITHUB_TOKEN}"
REPO="${2:-PerfectFriend/NeXXUs-Node}"

if [ -z "$TOKEN" ]; then
  echo "=========================================================="
  echo "GitHub Authentication Required"
  echo "=========================================================="
  echo "Usage:"
  echo "  bash scripts/push-to-github.sh <GITHUB_PERSONAL_ACCESS_TOKEN>"
  echo "or:"
  echo "  GITHUB_TOKEN=ghp_xxxx bash scripts/push-to-github.sh"
  exit 1
fi

git config --global --add safe.directory "$PWD" >/dev/null 2>&1 || true
git remote set-url origin "https://${TOKEN}@github.com/${REPO}.git"
git push -u origin main
git remote set-url origin "https://github.com/${REPO}.git"

echo "Push to https://github.com/$REPO completed successfully!"
