#!/usr/bin/env bash
set -euo pipefail

# Absolute project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIDECAR_DIR="$ROOT_DIR/agents/taskweaver"
LOG_DIR="/tmp/studiosix"
mkdir -p "$LOG_DIR"

echo "== StudioSix: starting all local services (sidecar + backend + frontend) =="

# 1) Generate or reuse shared token
TOKEN_FILE="$LOG_DIR/tw_shared_token"
if [ -s "$TOKEN_FILE" ]; then
  TW_TOKEN="$(cat "$TOKEN_FILE")"
else
  if command -v openssl >/dev/null 2>&1; then
    TW_TOKEN="$(openssl rand -hex 32)"
  else
    TW_TOKEN="tw_$(date +%s)_$RANDOM"
  fi
  echo "$TW_TOKEN" > "$TOKEN_FILE"
fi
echo "Shared token set (persisted at $TOKEN_FILE)"

# 2) Prepare sidecar .env (used by python-dotenv)
mkdir -p "$SIDECAR_DIR"
cat > "$SIDECAR_DIR/.env" <<EOF
TW_SHARED_TOKEN=$TW_TOKEN
NODE_URL=http://127.0.0.1:8080
EOF
echo "Wrote sidecar .env"

# 3) Create venv and install deps for sidecar if needed
cd "$SIDECAR_DIR"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
pip install -q fastapi uvicorn httpx python-dotenv sse-starlette >/dev/null

# 4) Start sidecar (port 8765)
SIDECAR_LOG="$LOG_DIR/tw.log"
SIDECAR_PID_FILE="$LOG_DIR/tw.pid"
if lsof -iTCP:8765 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "Sidecar already listening on 8765"
else
  nohup uvicorn server:app --host 0.0.0.0 --port 8765 --reload >"$SIDECAR_LOG" 2>&1 &
  echo $! > "$SIDECAR_PID_FILE"
  sleep 1
fi
echo "Sidecar log: $SIDECAR_LOG"

# 5) Start backend (Node) on 8080
cd "$ROOT_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
pkill -f "node simple-server.js" >/dev/null 2>&1 || true
PORT=8080 TASKWEAVER_URL=http://127.0.0.1:8765 TASKWEAVER_TOKEN="$TW_TOKEN" \
  nohup node simple-server.js >"$BACKEND_LOG" 2>&1 &
echo $! > "$BACKEND_PID_FILE"
sleep 1
echo "Backend log: $BACKEND_LOG"

# 6) Start frontend (React dev server) on 3000
FRONTEND_LOG="$LOG_DIR/frontend.log"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"
pkill -f "craco start" >/dev/null 2>&1 || true
REACT_APP_BACKEND_URL=http://127.0.0.1:8080 \
  nohup npm run start >"$FRONTEND_LOG" 2>&1 &
echo $! > "$FRONTEND_PID_FILE"
sleep 2
echo "Frontend log: $FRONTEND_LOG"

echo "== Running =="
echo "Sidecar (8765)  PID $(cat "$SIDECAR_PID_FILE" 2>/dev/null || true)"
echo "Backend (8080)  PID $(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
echo "Frontend (3000) PID $(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)"
echo "Token: $TW_TOKEN"
echo "Tip: tail -f $SIDECAR_LOG | $BACKEND_LOG | $FRONTEND_LOG"



