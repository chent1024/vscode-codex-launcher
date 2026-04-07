#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -d node_modules ]]; then
  echo "[open-codex] node_modules is missing, running npm install"
  npm install
fi

mkdir -p "$ROOT_DIR/.tmp"

VSIX_PATH="$(node -p "const pkg = require('./package.json'); \`.tmp/\${pkg.publisher}.\${pkg.name}-\${pkg.version}.vsix\`")"

rm -f "$VSIX_PATH"

echo "[open-codex] Packaging VSIX -> $VSIX_PATH"
npx @vscode/vsce package --out "$VSIX_PATH"

echo "$VSIX_PATH"
