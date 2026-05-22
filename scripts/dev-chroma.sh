#!/usr/bin/env sh
# Start a local Chroma HTTP server (no Docker). Used by `pnpm dev`.
set -e
cd "$(dirname "$0")/.."

read_env() {
  key="$1"
  default="$2"
  if [ -f .env ]; then
    val=$(grep -E "^${key}=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$default"
}

parse_chroma_url() {
  url="$1"
  case "$url" in
    http://*|https://*) ;;
    *) url="http://${url}" ;;
  esac
  rest="${url#*://}"
  host="${rest%%:*}"
  port="${rest#*:}"
  port="${port%%/*}"
  if [ "$host" = "$port" ] || [ -z "$port" ]; then
    port="80"
  fi
  CHROMA_HOST="$host"
  CHROMA_PORT="$port"
}

CHROMA_URL="${CHROMA_URL:-$(read_env CHROMA_URL http://127.0.0.1:28100)}"
parse_chroma_url "$CHROMA_URL"
CHROMA_PATH="./chroma_data"
PID_FILE=".chroma-dev.pid"

# chromadb Python client uses IPv4; `chroma run --host localhost` binds IPv6 only on macOS.
if [ "$CHROMA_HOST" = "localhost" ] || [ "$CHROMA_HOST" = "::1" ]; then
  CHROMA_HOST=127.0.0.1
  CHROMA_URL="http://127.0.0.1:${CHROMA_PORT}"
fi

if [ "$CHROMA_HOST" != "127.0.0.1" ]; then
  echo ">> CHROMA_URL=$CHROMA_URL (remote); skip starting local Chroma server"
  exit 0
fi

chroma_heartbeat() {
  curl -sf "http://${CHROMA_HOST}:${CHROMA_PORT}/api/v2/heartbeat" >/dev/null 2>&1 \
    || curl -sf "http://${CHROMA_HOST}:${CHROMA_PORT}/api/v1/heartbeat" >/dev/null 2>&1
}

chroma_ready() {
  chroma_heartbeat \
    && curl -sf "http://${CHROMA_HOST}:${CHROMA_PORT}/api/v2/auth/identity" >/dev/null 2>&1
}

chroma_python_ready() {
  if [ ! -x "apps/api/.venv/bin/python" ]; then
    return 1
  fi
  apps/api/.venv/bin/python -c "
import chromadb
chromadb.HttpClient(host='127.0.0.1', port=${CHROMA_PORT})
" >/dev/null 2>&1
}

free_local_chroma_port() {
  if [ -f "$PID_FILE" ]; then
    old_pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti ":${CHROMA_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

if chroma_ready && chroma_python_ready; then
  echo ">> Chroma HTTP already running at $CHROMA_URL"
  exit 0
fi

if chroma_heartbeat || chroma_ready; then
  echo ">> Port ${CHROMA_PORT} in use but Python client cannot connect; restarting..." >&2
  free_local_chroma_port
fi

CHROMA_BIN=""
if [ -x "apps/api/.venv/bin/chroma" ]; then
  CHROMA_BIN="apps/api/.venv/bin/chroma"
elif command -v chroma >/dev/null 2>&1; then
  CHROMA_BIN="chroma"
fi

if [ -z "$CHROMA_BIN" ]; then
  echo ">> chroma CLI not found. Install API deps:" >&2
  echo "   cd apps/api && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  echo ">> Or start Chroma yourself: chroma run --path ./chroma_data --host 127.0.0.1 --port ${CHROMA_PORT}" >&2
  exit 1
fi

mkdir -p "$CHROMA_PATH"
echo ">> Starting Chroma server ($CHROMA_URL, path=${CHROMA_PATH})"
"$CHROMA_BIN" run --path "$CHROMA_PATH" --host 127.0.0.1 --port "$CHROMA_PORT" &
echo $! >"$PID_FILE"

i=0
while [ "$i" -lt 45 ]; do
  if chroma_ready && chroma_python_ready; then
    echo ">> Chroma ready"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

echo ">> Chroma failed to start within 45s (see logs above)" >&2
exit 1
