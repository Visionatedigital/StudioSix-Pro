#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="/tmp/studiosix"

echo "== StudioSix: stopping all local services =="

# Stop by PID files if present
for f in "$LOG_DIR"/tw.pid "$LOG_DIR"/backend.pid "$LOG_DIR"/frontend.pid; do
  if [ -f "$f" ]; then
    PID=$(cat "$f" 2>/dev/null || true)
    if [ -n "${PID:-}" ]; then
      kill "$PID" >/dev/null 2>&1 || true
    fi
    rm -f "$f"
  fi
done

# Fallback: pkill by command patterns
pkill -f "uvicorn server:app --host 0.0.0.0 --port 8765" >/dev/null 2>&1 || true
pkill -f "node simple-server.js" >/dev/null 2>&1 || true
pkill -f "craco start" >/dev/null 2>&1 || true

sleep 1

echo "Sidecar listening on 8765: $(lsof -iTCP:8765 -sTCP:LISTEN -n -P | wc -l)"
echo "Backend listening on 8080: $(lsof -iTCP:8080 -sTCP:LISTEN -n -P | wc -l)"
echo "Frontend listening on 3000: $(lsof -iTCP:3000 -sTCP:LISTEN -n -P | wc -l)"
echo "== Stopped =="



