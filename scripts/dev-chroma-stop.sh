#!/usr/bin/env sh
# Stop Chroma started by dev-chroma.sh (if PID file exists).
cd "$(dirname "$0")/.."
PID_FILE=".chroma-dev.pid"

if [ ! -f "$PID_FILE" ]; then
  echo ">> No .chroma-dev.pid (Chroma may still be running from another terminal)"
  exit 0
fi

pid=$(cat "$PID_FILE")
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  echo ">> Stopped Chroma (pid $pid)"
else
  echo ">> Process $pid not running"
fi
rm -f "$PID_FILE"
