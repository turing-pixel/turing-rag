#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="myvps"
REMOTE_DIR="/root/turing-rag"
REPO_URL="https://github.com/turing-pixel/turing-rag.git"

echo "=== 1. 检查远程服务器 Docker 环境 ==="
ssh "$REMOTE_HOST" bash -s <<'SCRIPT'
  set -euo pipefail

  # Docker
  if ! command -v docker &>/dev/null; then
    echo ">> 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  else
    echo ">> Docker 已安装: $(docker --version)"
  fi

  # Docker Compose v2 (plugin)
  if ! docker compose version &>/dev/null; then
    echo ">> 安装 Docker Compose..."
    DOCKER_CONFIG=${DOCKER_CONFIG:-/usr/local/lib/docker/cli-plugins}
    mkdir -p "$DOCKER_CONFIG"
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o "$DOCKER_CONFIG/docker-compose"
    chmod +x "$DOCKER_CONFIG/docker-compose"
  else
    echo ">> Docker Compose 已安装: $(docker compose version)"
  fi
SCRIPT

echo ""
echo "=== 2. 克隆/更新代码 ==="
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"
if ssh "$REMOTE_HOST" "[ -d $REMOTE_DIR/.git ]"; then
  ssh "$REMOTE_HOST" "cd $REMOTE_DIR && git pull"
else
  ssh "$REMOTE_HOST" "git clone $REPO_URL $REMOTE_DIR"
fi

echo ""
echo "=== 3. 创建 .env（如不存在）==="
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && [ -f .env ] || cp .env.example .env"
echo ">> 请务必在服务器上编辑 $REMOTE_DIR/.env 填入 API Key 等配置"
echo "    ssh $REMOTE_HOST \"vi $REMOTE_DIR/.env\""

echo ""
echo "=== 4. 启动服务 ==="
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose up -d --build"

echo ""
echo "=== 部署完成 ==="
echo "    访问 http://$(ssh "$REMOTE_HOST" "curl -s ifconfig.me")"
