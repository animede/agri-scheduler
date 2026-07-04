#!/usr/bin/env bash
# backend (FastAPI, port 8000) と frontend (Vite, port 5173) を同時起動する。
# Ctrl+C で両方のプロセスを終了する。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend (http://localhost:8000) ..."
(cd "$ROOT_DIR/backend" && uv run uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

echo "Starting frontend (http://localhost:5173) ..."
(cd "$ROOT_DIR/frontend" && npm run dev -- --port 5173) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
