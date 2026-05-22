#!/usr/bin/env bash
# Deploy backend + frontend to VPS via Docker.
# Code sync: local rsync only (no git clone / pull on server).
# This script builds/starts docker-compose.prod.yml (backend + frontend) and ensures
# docker-compose.chroma.yml (Chroma HTTP) is up. It does NOT manage MinIO, Ollama, or PostgreSQL.
#
# Flow:
#   1. Check remote Docker
#   2. rsync local project -> REMOTE_DIR
#   3. docker compose -f docker-compose.prod.yml build (on server)
#   4. docker compose -f docker-compose.chroma.yml up -d (reuse ./chroma_data)
#   5. docker compose -f docker-compose.prod.yml up -d
#   6. alembic upgrade head
#
# Usage: ./deploy.sh
#   REMOTE_HOST=try_vps REMOTE_DIR=/home/ubuntu/turing-rag ./deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

REMOTE_HOST="${REMOTE_HOST:-try_vps}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/turing-rag}"
DOCKER="${DOCKER:-sudo docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
CHROMA_COMPOSE_FILE="${CHROMA_COMPOSE_FILE:-docker-compose.chroma.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# rsync: push local tree to server (never use git on remote)
RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude '.claude'
  --exclude 'node_modules'
  --exclude 'apps/web/node_modules'
  --exclude 'apps/web/.next'
  --exclude 'apps/api/venv'
  --exclude 'apps/api/.venv'
  --exclude 'apps/api/__pycache__'
  --exclude '*.pyc'
  --exclude 'chroma_data'
  --exclude 'minio_data'
  --exclude 'uploads'
  --exclude '.env'
  --exclude '.env.local'
)

read_env_var() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- \
    | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

require_local_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "错误: 未找到 $ENV_FILE"
    echo "请复制 .env.example 为 $ENV_FILE，按生产环境注释填写后重试。"
    exit 1
  fi
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "错误: 未找到 $COMPOSE_FILE"
    exit 1
  fi
  if [[ ! -f "$CHROMA_COMPOSE_FILE" ]]; then
    echo "错误: 未找到 $CHROMA_COMPOSE_FILE"
    exit 1
  fi
}

resolve_chroma_host_port() {
  local url port
  url="$(read_env_var CHROMA_URL)"
  if [[ -n "$url" ]]; then
    port="${url##*:}"
    port="${port%%/*}"
    echo "${port:-28100}"
    return
  fi
  echo "28100"
}

resolve_public_api_url() {
  local configured
  configured="$(read_env_var API_BASE_URL)"
  if [[ -n "$configured" ]]; then
    echo "$configured"
    return
  fi
  configured="$(read_env_var NEXT_PUBLIC_API_URL)"
  if [[ -n "$configured" ]]; then
    echo "$configured"
    return
  fi
  configured="$(read_env_var NEXT_PUBLIC_API_BASE_URL)"
  if [[ -n "$configured" ]]; then
    echo "$configured"
    return
  fi
  local server_ip
  server_ip="$(ssh "$REMOTE_HOST" "curl -fsS --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")"
  echo "http://${server_ip}:${BACKEND_PORT}"
}

echo "=== Turing RAG 生产部署（本地 rsync，不用 git）==="
echo "    远程: ${REMOTE_HOST}:${REMOTE_DIR}"
echo "    源码: ${SCRIPT_DIR}"
echo "    Compose: ${COMPOSE_FILE}"
echo "    环境: ${ENV_FILE}"
echo ""

require_local_env
CHROMA_HOST_PORT="$(resolve_chroma_host_port)"

PUBLIC_API_URL="$(resolve_public_api_url)"
echo ">> API_BASE_URL / NEXT_PUBLIC (build): ${PUBLIC_API_URL}"
echo ""

echo "=== 1/6 检查远程 Docker ==="
ssh "$REMOTE_HOST" "DOCKER='$DOCKER'" bash -s <<'SCRIPT'
  set -euo pipefail
  if ! command -v docker &>/dev/null; then
    echo ">> 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo systemctl enable --now docker
  else
    echo ">> Docker: $($DOCKER version | head -1)"
  fi
  if ! $DOCKER compose version &>/dev/null; then
    echo ">> 安装 Docker Compose 插件..."
    DOCKER_CONFIG=${DOCKER_CONFIG:-/usr/local/lib/docker/cli-plugins}
    sudo mkdir -p "$DOCKER_CONFIG"
    sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
      -o "$DOCKER_CONFIG/docker-compose"
    sudo chmod +x "$DOCKER_CONFIG/docker-compose"
  else
    echo ">> Compose: $($DOCKER compose version)"
  fi
SCRIPT

echo ""
echo "=== 2/6 本地 rsync -> 服务器（不含 git / node_modules / venv）==="
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete \
  "${RSYNC_EXCLUDES[@]}" \
  "$SCRIPT_DIR/" "${REMOTE_HOST}:${REMOTE_DIR}/"
# 生产环境单独上传（避免误覆盖本地其他 env）
scp -q "$ENV_FILE" "${REMOTE_HOST}:${REMOTE_DIR}/${ENV_FILE}"

ssh "$REMOTE_HOST" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  mkdir -p chroma_data uploads
  chmod 755 chroma_data uploads
  # 清理历史上可能 rsync 上去的 venv，减小 docker build context
  rm -rf apps/api/venv apps/api/.venv 2>/dev/null || true
SCRIPT

echo ">> 已同步到 ${REMOTE_DIR}"
echo ">> 保留远程数据目录: chroma_data, uploads（Chroma 向量数据，部署不会 rsync 覆盖）"

echo ""
echo "=== 3/6 远程 Docker 构建 ==="
echo ">> apps/api: python:3.11-slim + pip install + COPY app"
echo ">> frontend: turbo build @rag-web-ui/web (API_BASE_URL / WEB_BASE_URL -> NEXT_PUBLIC_*)"
BUILD_API_URL="$(read_env_var API_BASE_URL)"
BUILD_WEB_URL="$(read_env_var WEB_BASE_URL)"
if [[ -z "$BUILD_API_URL" ]]; then
  echo "错误: $ENV_FILE 中必须设置 API_BASE_URL（生产请使用 https://）"
  exit 1
fi
if [[ "$BUILD_API_URL" != https://* ]]; then
  echo "警告: API_BASE_URL 不是 https://，HTTPS 站点会出现 Mixed Content"
fi
ssh "$REMOTE_HOST" "DOCKER='$DOCKER'" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  export BACKEND_PORT='${BACKEND_PORT}'
  export FRONTEND_PORT='${FRONTEND_PORT}'
  export API_BASE_URL='${BUILD_API_URL}'
  export WEB_BASE_URL='${BUILD_WEB_URL}'
  \$DOCKER compose -f '$COMPOSE_FILE' --env-file '$ENV_FILE' build \\
    --build-arg API_BASE_URL="\${API_BASE_URL}" \\
    --build-arg WEB_BASE_URL="\${WEB_BASE_URL}"
SCRIPT

echo ""
echo "=== 4/6 启动 Chroma 容器（独立，数据目录 chroma_data）==="
ssh "$REMOTE_HOST" "DOCKER='$DOCKER'" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  export CHROMA_HOST_PORT='${CHROMA_HOST_PORT}'
  \$DOCKER compose -f '$CHROMA_COMPOSE_FILE' up -d
  echo ""
  \$DOCKER compose -f '$CHROMA_COMPOSE_FILE' ps
SCRIPT

echo ""
echo "=== 5/6 启动 backend + frontend ==="
ssh "$REMOTE_HOST" "DOCKER='$DOCKER'" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  export BACKEND_PORT='${BACKEND_PORT}'
  export FRONTEND_PORT='${FRONTEND_PORT}'
  \$DOCKER compose -f '$COMPOSE_FILE' --env-file '$ENV_FILE' up -d
  echo ""
  \$DOCKER compose -f '$COMPOSE_FILE' ps
SCRIPT

echo ""
echo "=== 6/6 数据库迁移 (alembic upgrade head) ==="
ssh "$REMOTE_HOST" "DOCKER='$DOCKER'" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  \$DOCKER compose -f '$COMPOSE_FILE' --env-file '$ENV_FILE' exec -T backend alembic upgrade head
SCRIPT

echo ""
echo "=== 健康检查 ==="
sleep 5
if ssh "$REMOTE_HOST" "curl -fsS --max-time 10 http://127.0.0.1:${CHROMA_HOST_PORT}/api/v2/heartbeat" &>/dev/null; then
  echo ">> Chroma heartbeat (${CHROMA_HOST_PORT}) 通过"
else
  echo ">> 警告: Chroma 健康检查未通过"
  echo "    ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && ${DOCKER} compose -f ${CHROMA_COMPOSE_FILE} logs --tail=80\""
fi
if ssh "$REMOTE_HOST" "curl -fsS --max-time 10 http://127.0.0.1:${BACKEND_PORT}/api/health" &>/dev/null; then
  echo ">> 后端 /api/health 通过"
else
  echo ">> 警告: 后端健康检查未通过"
  echo "    ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && ${DOCKER} compose -f ${COMPOSE_FILE} logs backend --tail=80\""
fi

SERVER_IP="$(ssh "$REMOTE_HOST" "curl -fsS --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")"
echo ""
echo "=== 部署完成 ==="
echo "    前端: http://${SERVER_IP}:${FRONTEND_PORT}"
echo "    后端: ${PUBLIC_API_URL}"
echo "    Chroma: http://127.0.0.1:${CHROMA_HOST_PORT} (容器 rag-chromadb, 数据 ${REMOTE_DIR}/chroma_data)"
echo "    日志: ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && ${DOCKER} compose -f ${COMPOSE_FILE} logs -f\""
echo "    Chroma 日志: ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && ${DOCKER} compose -f ${CHROMA_COMPOSE_FILE} logs -f\""
