#!/usr/bin/env bash
# Starts the Electron app when dependencies are installed; otherwise serves static files for browser mode.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -x node_modules/.bin/electron ]]; then
  exec env -u ELECTRON_RUN_AS_NODE npm start
fi

PORT="${PORT:-8765}"
URL="http://127.0.0.1:${PORT}"
echo "Electron not installed — running browser mode at ${URL}"
echo "For the desktop app: npm install && npm start"
if command -v open >/dev/null 2>&1; then
  (sleep 0.4 && open "${URL}") &
fi
exec python3 -m http.server "$PORT"
