#!/usr/bin/env bash
# Deploy backend + frontend to VPS via Docker.
# Code sync: local rsync only (no git clone / pull on server).
# This script only builds/starts services in docker-compose.prod.yml (backend + frontend).
# It does NOT build or restart MinIO, Ollama, or PostgreSQL: manage those separately on the host / other compose stacks.
#
# Flow:
#   1. Check remote Docker
#   2. rsync local project -> REMOTE_DIR
#   3. docker compose -f docker-compose.prod.yml build (on server)
#   4. docker compose up -d
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
    echo "请复制 .env.production.example 为 $ENV_FILE 并填写配置后重试。"
    exit 1
  fi
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "错误: 未找到 $COMPOSE_FILE"
    exit 1
  fi
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

PUBLIC_API_URL="$(resolve_public_api_url)"
echo ">> API_BASE_URL / NEXT_PUBLIC (build): ${PUBLIC_API_URL}"
echo ""

echo "=== 1/5 检查远程 Docker ==="
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
echo "=== 2/5 本地 rsync -> 服务器（不含 git / node_modules / venv）==="
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
echo ">> 保留远程数据目录: chroma_data, uploads"

echo ""
echo "=== 3/5 远程 Docker 构建 ==="
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
echo "=== 4/5 启动容器 ==="
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
echo "=== 5/5 数据库迁移 (alembic upgrade head) ==="
ssh "$REMOTE_HOST" "DOCKER='$DOCKER'" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  \$DOCKER compose -f '$COMPOSE_FILE' --env-file '$ENV_FILE' exec -T backend alembic upgrade head
SCRIPT

echo ""
echo "=== 健康检查 ==="
sleep 5
if ssh "$REMOTE_HOST" "curl -fsS --max-time 10 http://127.0.0.1:${BACKEND_PORT}/api/health" &>/dev/null; then
  echo ">> 后端 /api/health 通过"
else
  echo ">> 警告: 健康检查未通过"
  echo "    ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && ${DOCKER} compose -f ${COMPOSE_FILE} logs backend --tail=80\""
fi

SERVER_IP="$(ssh "$REMOTE_HOST" "curl -fsS --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")"
echo ""
echo "=== 部署完成 ==="
echo "    前端: http://${SERVER_IP}:${FRONTEND_PORT}"
echo "    后端: ${PUBLIC_API_URL}"
echo "    日志: ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && ${DOCKER} compose -f ${COMPOSE_FILE} logs -f\""
