#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${EDITOR_CLI:-}"
NO_RELOAD=0
SKIP_NPM_INSTALL=0

usage() {
  cat <<'EOF'
Usage: bash ./scripts/install-and-reload.sh [options]

Options:
  --cli <name>          Editor CLI to use, for example: code, cursor, code-insiders
  --no-reload           Install the extension but skip the automatic editor reload step
  --skip-npm-install    Skip npm install even if node_modules is missing
  -h, --help            Show this help message
EOF
}

log() {
  printf '\033[1;34m[open-codex]\033[0m %s\n' "$1"
}

warn() {
  printf '\033[1;33m[open-codex]\033[0m %s\n' "$1" >&2
}

fail() {
  printf '\033[1;31m[open-codex]\033[0m %s\n' "$1" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli)
      [[ $# -ge 2 ]] || fail "--cli requires a value"
      CLI="$2"
      shift 2
      ;;
    --no-reload)
      NO_RELOAD=1
      shift
      ;;
    --skip-npm-install)
      SKIP_NPM_INSTALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

pick_cli() {
  local candidates=()

  if [[ -n "$CLI" ]]; then
    candidates=("$CLI")
  else
    candidates=(code cursor code-insiders codium)
  fi

  local candidate
  for candidate in "${candidates[@]}"; do
    if command -v "$candidate" >/dev/null 2>&1; then
      CLI="$candidate"
      return 0
    fi
  done

  return 1
}

app_name_for_cli() {
  case "$1" in
    code)
      printf '%s\n' "Visual Studio Code"
      ;;
    cursor)
      printf '%s\n' "Cursor"
      ;;
    code-insiders)
      printf '%s\n' "Visual Studio Code - Insiders"
      ;;
    codium)
      printf '%s\n' "VSCodium"
      ;;
    *)
      return 1
      ;;
  esac
}

reload_editor_window() {
  local cli="$1"
  local app_name

  app_name="$(app_name_for_cli "$cli")" || return 1

  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 1
  fi

  if ! command -v osascript >/dev/null 2>&1; then
    return 1
  fi

  osascript - "$app_name" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv

  tell application appName to activate
  delay 0.3

  tell application "System Events"
    keystroke "p" using {command down, shift down}
    delay 0.3
    keystroke "Developer: Reload Window"
    delay 0.3
    key code 36
  end tell
end run
APPLESCRIPT
}

pick_cli || fail "Could not find a supported editor CLI. Pass --cli <name> or install the VS Code/Cursor command line tool."

cd "$ROOT_DIR"

if [[ ! -d node_modules ]]; then
  if [[ "$SKIP_NPM_INSTALL" -eq 1 ]]; then
    fail "node_modules is missing and --skip-npm-install was provided"
  fi

  log "node_modules is missing, running npm install"
  npm install
fi

log "Building extension"
npm run build

mkdir -p "$ROOT_DIR/.tmp"

EXTENSION_ID="$(node -p "const pkg = require('./package.json'); \`\${pkg.publisher}.\${pkg.name}\`")"
VSIX_PATH="$ROOT_DIR/.tmp/${EXTENSION_ID}.vsix"

rm -f "$VSIX_PATH"

log "Packaging VSIX -> $VSIX_PATH"
npx @vscode/vsce package --out "$VSIX_PATH"

log "Installing extension via $CLI"
"$CLI" --install-extension "$VSIX_PATH" --force

if [[ "$NO_RELOAD" -eq 0 ]]; then
  log "Reloading editor window"
  if reload_editor_window "$CLI"; then
    log "Reload request sent"
  else
    warn "Automatic reload was skipped or failed. Reload the editor window manually if the new code is not active yet."
  fi
fi

log "Extension installed: $EXTENSION_ID"
