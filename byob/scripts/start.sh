#!/bin/bash
# scripts/start.sh — BYOB startup script for Linux / macOS

set -e

# Check Node version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  echo ""
  echo "  ✗ BYOB requires Node.js 18 or higher."
  echo "  Current: $(node -v 2>/dev/null || echo 'not found')"
  echo "  Install: https://nodejs.org"
  echo ""
  exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo ""
  echo "  Installing dependencies..."
  npm install --silent
fi

echo ""
echo "  💀 BYOB: Break Your Own Boxes"
echo "  ──────────────────────────────"
node server.js
