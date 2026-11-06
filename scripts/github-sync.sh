#!/usr/bin/env bash
set -e

# ==============================================================================
# NeXXUs GitHub Sync & Remote Connection Helper
# Repository: https://github.com/PerfectFriend/NeXXUs-Node
# ==============================================================================

REPO_URL="https://github.com/PerfectFriend/NeXXUs-Node.git"

echo "=========================================================="
echo "🐙 NeXXUs GitHub Connection & Sync Helper"
echo "=========================================================="
echo "Target Repository: $REPO_URL"

# Ensure safe directory is configured
git config --global --add safe.directory "$PWD" >/dev/null 2>&1 || true

# Ensure remote is set
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
else
  git remote set-url origin "$REPO_URL"
fi

echo "Current Remote:"
git remote -v

echo ""
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'main')"

# Check connection to remote
echo "🔍 Checking connection to GitHub..."
if git ls-remote origin HEAD >/dev/null 2>&1; then
  echo "✅ Remote repository is reachable!"
else
  echo "ℹ️ Note: If repository is private or requires authentication,"
  echo "   provide your GitHub Personal Access Token (PAT) when prompted,"
  echo "   or configure SSH via: git remote set-url origin git@github.com:PerfectFriend/NeXXUs-Node.git"
fi

echo ""
echo "Commands to push updates:"
echo "  git add ."
echo "  git commit -m 'NeXXUs v2.0-rust canonical release'"
echo "  git push -u origin main"
echo "=========================================================="
