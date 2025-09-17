#!/usr/bin/env bash
set -euo pipefail

# Restart frontend and backend, then tail logs (Ctrl-C to stop)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Killing running servers (frontend :3000, backend :8080)"
# Kill by port (hard stop) then by process name (best-effort)
if lsof -ti tcp:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -ti tcp:8080 -sTCP:LISTEN | xargs kill -9 || true
fi
if lsof -ti tcp:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9 || true
fi
pkill -f "node simple-server.js" || true
pkill -f "react-scripts start" || true
pkill -f "craco start" || true

echo "==> Ensuring logs directory exists"
mkdir -p logs

echo "==> Starting backend on :8080"
nohup npm run start:backend > logs/server.log 2>&1 &
echo $! > logs/server.pid

echo "==> Starting frontend on :3000"
nohup npm run start:dev > logs/frontend.log 2>&1 &
echo $! > logs/frontend.pid

echo "==> Backend PID: $(cat logs/server.pid 2>/dev/null || echo '?')"
echo "==> Frontend PID: $(cat logs/frontend.pid 2>/dev/null || echo '?')"

echo "==> Tailing logs (Ctrl-C to stop)"
tail -n 50 -f logs/server.log logs/frontend.log


