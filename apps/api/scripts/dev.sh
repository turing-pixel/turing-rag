#!/usr/bin/env sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Root .env often uses Docker Compose hostnames (db, chromadb). When uvicorn runs on
# the host (pnpm dev), those names do not resolve; export localhost overrides before
# Python loads pydantic-settings (env vars beat .env file).
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
  # Compose service name minio; host-native API should hit your real MinIO listen address.
  case "${MINIO_ENDPOINT:-}" in
    minio:*)
      export MINIO_ENDPOINT="localhost:${MINIO_ENDPOINT#minio:}"
      ;;
  esac
fi

# LangChain / Pydantic in this repo are not compatible with Python 3.14+ yet.
unsupported_py() {
  "$1" -c 'import sys; raise SystemExit(0 if sys.version_info < (3, 14) else 1)'
}

run_uvicorn() {
  PY="$1"
  if [ ! -f /.dockerenv ]; then
    echo "apps/api: running database migrations..."
    "$PY" -m alembic upgrade head
  fi
  exec "$PY" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

if [ -x ".venv/bin/python" ]; then
  if ! unsupported_py ".venv/bin/python"; then
    echo "apps/api: this venv uses Python 3.14+, which breaks Pydantic/LangChain here." >&2
    echo "Recreate with Python 3.11 or 3.12 (matches Docker):" >&2
    echo "  cd apps/api && rm -rf .venv && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
    exit 1
  fi
  run_uvicorn ".venv/bin/python"
fi

for cmd in python3.12 python3.11 python3.13 python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    continue
  fi
  if ! unsupported_py "$cmd"; then
    continue
  fi
  run_uvicorn "$cmd"
done

echo "apps/api: need Python 3.11 or 3.12 (not 3.14+). Install 3.12 or run:" >&2
echo "  cd apps/api && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
exit 1
