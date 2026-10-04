#!/usr/bin/env bash
# Start the VENT local TTS server (Kokoro-82M + Chatterbox-Turbo clone via mlx-audio) on 127.0.0.1:8880.
#   ./start.sh          -> foreground
#   ./start.sh --bg     -> background (nohup), logs to voice/server.log, pid in voice/server.pid
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v espeak-ng >/dev/null 2>&1; then
  echo "[vent-tts] installing espeak-ng (needed for OOV words / Hindi)..."
  brew install espeak-ng
fi

export HF_HOME="${HF_HOME:-$PWD/.cache/huggingface}"
export UV_HTTP_TIMEOUT="${UV_HTTP_TIMEOUT:-300}"
uv sync --quiet

if [[ "${1:-}" == "--bg" ]]; then
  # Replace a server that's already running (e.g. to pick up a new voice reference).
  if [[ -f server.pid ]] && kill -0 "$(cat server.pid)" 2>/dev/null; then
    kill "$(cat server.pid)"; sleep 1
  fi
  nohup uv run --no-sync python server.py > server.log 2>&1 &
  echo $! > server.pid
  echo "[vent-tts] started in background (pid $(cat server.pid)); waiting for /health..."
  for _ in $(seq 1 120); do
    if curl -sf http://127.0.0.1:${VENT_TTS_PORT:-8880}/health | grep -q '"ready":true'; then
      curl -s http://127.0.0.1:${VENT_TTS_PORT:-8880}/health; echo; exit 0
    fi
    sleep 1
  done
  echo "[vent-tts] not ready after 120s; see voice/server.log"; exit 1
else
  exec uv run --no-sync python server.py
fi
