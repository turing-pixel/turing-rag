#!/usr/bin/env bash
# Deploy backend + frontend to VPS via Docker.
# Host services: PostgreSQL, MinIO, Ollama (not managed by this script).
# Usage: ./deploy.sh
#   REMOTE_HOST=try_vps REMOTE_DIR=/root/turing-rag ./deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

REMOTE_HOST="${REMOTE_HOST:-try_vps}"
REMOTE_DIR="${REMOTE_DIR:-/root/turing-rag}"
REPO_URL="${REPO_URL:-https://github.com/turing-pixel/turing-rag.git}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKEND_PORT="${BACKEND_PORT:-8765}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

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
}

resolve_public_api_url() {
  local configured
  configured="$(read_env_var NEXT_PUBLIC_API_URL)"
  if [[ -n "$configured" ]]; then
    echo "$configured"
    return
  fi

  local server_ip
  server_ip="$(ssh "$REMOTE_HOST" "curl -fsS --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")"
  echo "http://${server_ip}:${BACKEND_PORT}"
}

echo "=== Turing RAG 生产部署 ==="
echo "    远程: ${REMOTE_HOST}:${REMOTE_DIR}"
echo "    Compose: ${COMPOSE_FILE}"
echo "    环境文件: ${ENV_FILE}"
echo ""

require_local_env

PUBLIC_API_URL="$(resolve_public_api_url)"
echo ">> 前端 API 地址 (NEXT_PUBLIC_API_URL): ${PUBLIC_API_URL}"
echo ""

echo "=== 1. 检查远程 Docker 环境 ==="
ssh "$REMOTE_HOST" bash -s <<'SCRIPT'
  set -euo pipefail

  if ! command -v docker &>/dev/null; then
    echo ">> 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  else
    echo ">> Docker: $(docker --version)"
  fi

  if ! docker compose version &>/dev/null; then
    echo ">> 安装 Docker Compose 插件..."
    DOCKER_CONFIG=${DOCKER_CONFIG:-/usr/local/lib/docker/cli-plugins}
    mkdir -p "$DOCKER_CONFIG"
    curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
      -o "$DOCKER_CONFIG/docker-compose"
    chmod +x "$DOCKER_CONFIG/docker-compose"
  else
    echo ">> Compose: $(docker compose version)"
  fi
SCRIPT

echo ""
echo "=== 2. 同步代码 ==="
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"
if ssh "$REMOTE_HOST" "[ -d '$REMOTE_DIR/.git' ]"; then
  ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && git pull --ff-only"
else
  ssh "$REMOTE_HOST" "git clone '$REPO_URL' '$REMOTE_DIR'"
fi

echo ""
echo "=== 3. 同步配置与数据目录 ==="
scp -q "$ENV_FILE" "${REMOTE_HOST}:${REMOTE_DIR}/${ENV_FILE}"
scp -q "$COMPOSE_FILE" "${REMOTE_HOST}:${REMOTE_DIR}/${COMPOSE_FILE}"

ssh "$REMOTE_HOST" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'
  mkdir -p chroma_data uploads
  chmod 755 chroma_data uploads
SCRIPT

echo ">> 已上传 ${ENV_FILE}、${COMPOSE_FILE}"
echo ">> 数据目录: ${REMOTE_DIR}/chroma_data, ${REMOTE_DIR}/uploads"

echo ""
echo "=== 4. 构建并启动 (backend + frontend) ==="
ssh "$REMOTE_HOST" bash -s <<SCRIPT
  set -euo pipefail
  cd '$REMOTE_DIR'

  export NEXT_PUBLIC_API_URL='${PUBLIC_API_URL}'
  export BACKEND_PORT='${BACKEND_PORT}'
  export FRONTEND_PORT='${FRONTEND_PORT}'

  docker compose -f '$COMPOSE_FILE' --env-file '$ENV_FILE' build
  docker compose -f '$COMPOSE_FILE' --env-file '$ENV_FILE' up -d

  echo ""
  echo ">> 容器状态:"
  docker compose -f '$COMPOSE_FILE' ps
SCRIPT

echo ""
echo "=== 5. 健康检查 ==="
sleep 5
if ssh "$REMOTE_HOST" "curl -fsS --max-time 10 http://127.0.0.1:${BACKEND_PORT}/api/health" &>/dev/null; then
  echo ">> 后端健康检查通过"
else
  echo ">> 警告: 后端健康检查未通过，请查看日志:"
  echo "    ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} logs backend --tail=80\""
fi

SERVER_IP="$(ssh "$REMOTE_HOST" "curl -fsS --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")"

echo ""
echo "=== 部署完成 ==="
echo "    前端: http://${SERVER_IP}:${FRONTEND_PORT}"
echo "    后端 API: ${PUBLIC_API_URL}"
echo "    查看日志: ssh ${REMOTE_HOST} \"cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} logs -f\""
echo ""
echo "宿主机需已运行: PostgreSQL、MinIO、Ollama"
echo "Chroma 向量数据目录: ${REMOTE_DIR}/chroma_data (persistent 模式)"
