#!/usr/bin/env sh
# Clear PostgreSQL, MinIO, vector collections, and local upload temp.
# Examples:
#   sh scripts/reset_data.sh --dry-run
#   sh scripts/reset_data.sh --confirm
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Same host overrides as dev.sh when running outside Docker.
if [ ! -f /.dockerenv ]; then
  export ENVIRONMENT="${ENVIRONMENT:-development}"
  if [ "${POSTGRES_SERVER:-db}" = "db" ]; then
    export POSTGRES_SERVER=localhost
  fi
  case "${CHROMA_URL:-}" in
    *chromadb*|*localhost*)
      export CHROMA_URL="http://127.0.0.1:28100"
      ;;
  esac
  case "${MINIO_ENDPOINT:-}" in
    minio:*)
      export MINIO_ENDPOINT="localhost:${MINIO_ENDPOINT#minio:}"
      ;;
  esac
fi

run_python() {
  PY="$1"
  shift
  exec "$PY" scripts/reset_data.py "$@"
}

if [ -x ".venv/bin/python" ]; then
  run_python ".venv/bin/python" "$@"
fi

for cmd in python3.12 python3.11 python3.13 python3; do
  if command -v "$cmd" >/dev/null 2>&1; then
    run_python "$cmd" "$@"
  fi
done

echo "apps/api: need Python 3.11+ with dependencies installed." >&2
echo "  cd apps/api && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
exit 1
