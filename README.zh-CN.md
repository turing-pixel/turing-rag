# 智能知识库与对话

<div align="center">
  <p><strong>基于 RAG 的知识库问答 — 上传资料、自然语言提问、回答附带引用出处</strong></p>
  <p>
    <a href="LICENSE">Apache License 2.0</a>
    · <a href="README.md">English</a> | <strong>简体中文</strong>
  </p>
</div>

## 目录

**所有人**

- [产品概览](#产品概览)
- [工作原理](#工作原理)

**终端用户**

- [面向终端用户](#面向终端用户)
- [Web 端使用指南](#web-端使用指南)
- [支持的文档格式](#支持的文档格式)
- [使用建议与限制](#使用建议与限制)

**开发者**

- [面向开发者](#面向开发者)
- [系统架构](#系统架构)
- [快速开始（Docker）](#快速开始docker)
- [本地开发](#本地开发)
- [项目结构](#项目结构)
- [配置说明](#配置说明)
- [API 集成](#api-集成)
- [部署](#部署)
- [延伸阅读](#延伸阅读)
- [上游项目与许可证](#上游项目与许可证)

---

## 产品概览

| 角色 | 你能获得什么 |
|------|----------------|
| **终端用户** | 网页端上传 PDF/Word/Markdown/文本，针对自己的知识库对话，查看引用与检索进度，无需了解机器学习术语 |
| **开发者** | 可自托管的 monorepo（Next.js + FastAPI），可插拔的对话/向量模型、Chroma 或 Qdrant、OpenAPI 检索，以及 Docker 与 `pnpm dev` 工作流 |

---

## 工作原理

```mermaid
flowchart LR
  A[上传文档] --> B[解析、分块、向量化]
  C[用户提问] --> D[检索相关片段]
  B --> D
  D --> E[大模型生成回答]
  E --> F[引用与原文预览]
```

1. 文档经解析、分块后写入向量数据库。
2. 每次提问会从所选知识库中检索最相关片段。
3. 对话模型组织回答；界面可展示 **引用角标**、**原文片段**，以及检索进行中的 **状态流**。

---

## 面向终端用户

### 能做什么

- **知识库** — 按主题组织内容（如人事制度、产品手册）。
- **资料问答** — 用日常语言提问；回答优先依据 **您上传的文件**，而非公开互联网。
- **多轮对话** — 同一会话内连续追问；每次对话可选择一个或多个知识库。
- **核对出处** — 模型引用文档时，可点击引用序号查看原文预览。
- **语言** — 界面可在中英文间切换（URL 中的 `/en` … 或 `/zh` …，或页头语言切换器）。

### 典型工作流

| 目标 | 步骤 |
|------|------|
| 建库 | 控制台 → **知识库** → 新建 → **上传** → 等待处理完成 |
| 测检索 | 打开知识库 → **检索测试** → 不进入对话即可试 query |
| 提问 | **对话** → 新建会话 → 选择知识库 → 输入并发送 |
| 对接其他应用 | **API 密钥** → 创建密钥 → 调用 OpenAPI 检索接口（见 [API 集成](#api-集成)） |

管理员还可在 **模型配置** 中维护对话模型与 Embedding（也可在首次登录前通过服务器 `.env` 配置）。

### Web 端使用指南

部署方提供访问地址后（如 `https://app.example.com` 或 `http://localhost:3000`）：

1. **注册 / 登录** — 账号归属当前部署实例，无公用云租户。
2. **创建知识库** — 命名，可选设置图标/颜色。
3. **上传文件** — 拖拽或选择文件；状态为 **已完成** 后再提问效果更好。
4. **可选：预览分块** — 上传过程中可预览文本如何分块（块大小 / 重叠）。
5. **开始对话** — 选择知识库并提问；可在检索面板查看搜索进度与命中文档。
6. **重新生成或反馈** — 对助手消息可重新生成，或在启用时提交赞/踩。

**主要功能入口**

| 模块 | 路径（含语言前缀） | 说明 |
|------|-------------------|------|
| 概览 | `/dashboard` | 入口 |
| 知识库 | `/dashboard/knowledge` | 知识库、文档、上传与处理状态 |
| 对话 | `/dashboard/chat` | RAG 对话、引用、流式输出 |
| RAG 流程 | `/dashboard/rag` | RAG 流程示意/说明 |
| 对话模型 | `/dashboard/llm-configs` | 对话模型（多厂商、校验与默认项） |
| 向量模型 | `/dashboard/embedding-configs` | Embedding 模型（更换后可能需重新入库） |
| API 密钥 | `/dashboard/api-keys` | 程序化检索用的密钥 |

### 支持的文档格式

| 类型 | 扩展名 | 单文件上限（前端） |
|------|--------|-------------------|
| PDF | `.pdf` | 50 MB |
| Word | `.docx` | 50 MB |
| Markdown | `.md` | 50 MB |
| 纯文本 | `.txt` | 50 MB |

无文字层的扫描版 PDF 可能解析较差，建议尽量使用可选中文字的版本。

### 使用建议与限制

- **等待入库完成** — 文档处理显示 **已完成** 后再提问，效果更稳定。
- **核对引用** — 涉及数字、日期、法律/医疗/财务等内容，请以原始文件为准。
- **模型局限** — 大模型可能编造或遗漏上下文；检索增强能提高依据性，但不能保证完全正确。
- **隐私** — 仅上传有权保存的资料；留存与合规取决于贵司如何托管系统。
- **支持** — 登录、上传或回答质量问题请联系部署方（除非您自行托管本仓库）。

---

## 面向开发者

本仓库为 **pnpm + Turborepo monorepo**：`apps/web`（Next.js 14、App Router、`next-intl`）与 `apps/api`（FastAPI、LangChain、Alembic）。元数据在 **PostgreSQL**；文件在 **MinIO**；向量在 **Chroma**（默认）或 **Qdrant**。

Fork 自 [rag-web-ui/rag-web-ui](https://github.com/rag-web-ui/rag-web-ui)，主要演进包括 PostgreSQL、统一 `CHAT_*` / `EMBEDDINGS_*` 环境变量、控制台模型配置、检索流式 UI 等。

### 系统架构

```mermaid
flowchart TB
  subgraph client["浏览器"]
    Web["Next.js apps/web"]
  end
  subgraph api["FastAPI apps/api"]
    Auth["JWT 认证"]
    KB["知识库与文档"]
    Chat["对话 + RAG"]
    Open["OpenAPI /openapi"]
  end
  subgraph data["数据层"]
    PG[(PostgreSQL)]
    MinIO[(MinIO)]
    VS[(Chroma / Qdrant)]
  end
  subgraph external["外部服务"]
    LLM["对话模型"]
    EMB["Embedding 模型"]
  end
  Web --> Auth
  Web --> KB
  Web --> Chat
  Open --> VS
  KB --> PG
  KB --> MinIO
  KB --> EMB
  Chat --> VS
  Chat --> LLM
  Chat --> PG
```

### 快速开始（Docker）

**环境要求：** Docker Compose v2+，建议 8GB+ 内存。

```bash
git clone <your-repo-url>
cd rag-web-ui
cp .env.example .env
# 配置 CHAT_PROVIDER、CHAT_API_KEY、EMBEDDINGS_PROVIDER 等
docker compose up -d --build
```

| 服务 | 默认地址 |
|------|----------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| API 文档（ReDoc） | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/api/v1/openapi.json |
| MinIO 控制台 | http://localhost:9001（minioadmin / minioadmin） |
| Chroma（宿主机端口） | http://localhost:8001 |

Compose 内 API 使用 `CHROMA_URL=http://chromadb:8000`。若对话/向量走宿主机 **Ollama**，请将 `CHAT_API_BASE`、`EMBEDDINGS_API_BASE` 设为 `http://host.docker.internal:11434`，并先拉取模型（如 `deepseek-r1:7b`、`bge-m3`）。

### 本地开发

**环境要求**

| 工具 | 版本 |
|------|------|
| Node.js | 18+ |
| pnpm | 9.x（见根目录 `packageManager`） |
| Python | **仅 3.11 或 3.12**（3.14 与当前 Pydantic/LangChain 不兼容） |
| Docker | 可选，通常用于 Postgres + MinIO |

**推荐混合开发** — 有状态服务用 Docker，应用在宿主机：

```bash
cp .env.example .env
# 可保留 POSTGRES_SERVER=db、MINIO_ENDPOINT=minio:9000 — dev.sh 会映射到 localhost

docker compose up -d db minio   # Postgres :5432，MinIO :9000 / :9001

pnpm install
cd apps/api && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..

pnpm dev   # 本机 Chroma 127.0.0.1:28100 + turbo dev（前端 :3000，API :8000）
```

`apps/api/scripts/dev.sh`（由 turbo 调用）会自动：

- 在宿主机执行 `alembic upgrade head`
- `POSTGRES_SERVER=db` → `localhost`
- `MINIO_ENDPOINT=minio:9000` → `localhost:9000`
- 将含 `chromadb` 或 `localhost` 的 `CHROMA_URL` 改为 `http://127.0.0.1:28100`

macOS 上 Chroma 请使用 **`127.0.0.1`**（勿用 `localhost`），避免 IPv6/IPv4 不一致导致 502。

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 本机 Chroma（`./chroma_data`）+ 前后端 |
| `pnpm dev:chroma` | 仅 Chroma HTTP |
| `pnpm dev:chroma:stop` | 停止 dev 脚本拉起的 Chroma |
| `pnpm dev:app` | 仅前后端（需 Chroma 已运行） |
| `pnpm build` | 生产构建（Turbo） |
| `pnpm lint` | 全仓库静态检查 |
| `pnpm test` / `pnpm test:ci` | 测试 |
| `pnpm reset-data` | 重置业务数据（破坏性，API 包） |
| `pnpm reset-data:dry-run` | 预览重置范围 |

**环境文件**

- 根目录 **`.env`** — API 与文档默认项；Compose 与 `pnpm dev` 共用。
- **`apps/api/.env`** — 可选，仅覆盖后端。
- **`apps/web/.env.local`** — 可选，Next.js 覆盖项（见 `next.config.js`）。

### 项目结构

```
rag-web-ui/
├── apps/
│   ├── api/                 # FastAPI、Alembic、文档流水线、RAG 对话
│   │   ├── app/api/api_v1/  # REST：认证、知识库、对话、llm/embedding 配置
│   │   ├── app/api/openapi/ # API Key 检索
│   │   └── scripts/         # dev.sh、reset_data.py
│   └── web/                 # Next.js 控制台、对话 UI、i18n（en/zh）
├── docs/                    # 排错、Embedding 指南、教程
├── scripts/                 # dev-chroma.sh、dev-chroma-stop.sh
├── docker-compose.yml       # 完整开发栈（db、minio、chromadb、api、web）
├── docker-compose.prod.yml  # 生产镜像
├── docker-compose.chroma.yml
├── deploy.sh                # rsync + 生产 compose + 迁移
├── .env.example
└── package.json             # Turborepo 根脚本
```

### 配置说明

复制 `.env.example` → `.env`（本地）或 `.env.production`（`./deploy.sh`）。

**对话模型（`CHAT_PROVIDER` + `CHAT_API_*`）**

| 类型 | 说明 |
|------|------|
| `openai`、`deepseek`、`minimax`、`ollama` | 内置适配 |
| `anthropic`、`google`、`qwen`、`kimi`、`mistral`、`azure`、`zhipu` 等 | OpenAI 兼容 Base URL |
| 控制台 | 可在 **对话模型** 中增删配置（存数据库） |

**向量模型（`EMBEDDINGS_PROVIDER` + `EMBEDDINGS_API_*`）**

| 类型 | 说明 |
|------|------|
| `openai`、`ollama`、`dashscope`、`huggingface` | 模型名见 `.env.example` |
| 维度变更 | 更换 Embedding 模型后需 **重新处理** 文档 |

DeepSeek **不提供** Embedding API — `EMBEDDINGS_PROVIDER` 请使用 `ollama`、`openai` 或 `huggingface`。

**基础设施**

| 变量 | 用途 |
|------|------|
| `POSTGRES_*` | 元数据（用户、知识库、对话、配置） |
| `MINIO_*` | 原始文档对象存储 |
| `VECTOR_STORE_TYPE` | `chroma`（默认）或 `qdrant` |
| `CHROMA_URL` | HTTP 地址（开发：`http://127.0.0.1:28100`；Compose：`http://chromadb:8000`；生产 Docker：`http://host.docker.internal:28100`） |
| `SECRET_KEY` | JWT 签名 — **生产环境务必更换** |
| `API_BASE_URL`、`WEB_BASE_URL`、`CORS_ALLOWED_ORIGINS` | 生产对外 URL |

旧版分散变量（`OPENAI_API_KEY`、`DEEPSEEK_*` 等）在 `CHAT_*` / `EMBEDDINGS_*` 为空时仍可作为回退。

指南：[docs/OLLAMA_EMBEDDINGS.md](docs/OLLAMA_EMBEDDINGS.md)、[docs/HUGGINGFACE_EMBEDDINGS.md](docs/HUGGINGFACE_EMBEDDINGS.md)。

### API 集成

- **浏览器 / SPA** — 通过 `POST /api/v1/auth/token` 获取 JWT，访问 `/api/v1/*` 时携带 Bearer。
- **服务端检索** — 在控制台创建 API Key，请求头 `X-API-Key: <密钥>` 调用 `/openapi` 下路由。示例：`GET /openapi/{knowledge_base_id}/query?query=...&top_k=3`（见 ReDoc）。
- **Schema** — `http://localhost:8000/api/v1/openapi.json` 与 `/redoc`。

文档入库与对话流式接口在 `/api/v1/` 下；完整路由见 `apps/api/app/api/api_v1/`。

### 部署

| 方式 | 适用场景 |
|------|----------|
| `docker compose up -d --build` | 单机开发/演示全栈 |
| `docker compose -f docker-compose.prod.yml` | 生产前后端容器 |
| `docker compose -f docker-compose.chroma.yml` | 独立 Chroma HTTP（`./chroma_data`；由 `deploy.sh` 启动） |
| `./deploy.sh` | rsync 到 VPS、构建生产 compose、执行 Alembic；**不会**在服务器安装 Postgres/MinIO/Ollama |

生产检查项：

- 强 `SECRET_KEY`、数据库密码、MinIO 凭证
- `API_BASE_URL`、`WEB_BASE_URL`、`CORS_ALLOWED_ORIGINS`
- API 在 Docker、Chroma 在宿主机时：`CHROMA_URL=http://host.docker.internal:28100`
- 备份 `chroma_data/`、Postgres、MinIO 卷 — `deploy.sh` 的 rsync 不会覆盖服务器上的 `chroma_data`

### 延伸阅读

| 文档 | 内容 |
|------|------|
| [docs/troubleshooting.md](docs/troubleshooting.md) | 数据库、迁移、常见错误 |
| [docs/ADD_DOCUMENT_FLOW.md](docs/ADD_DOCUMENT_FLOW.md) | 上传 → 分块 → 向量化流程 |
| [docs/tutorial/README.md](docs/tutorial/README.md) | RAG 教程（中文） |
| [docs/blog/deploy-local.md](docs/blog/deploy-local.md) | 本地部署笔记 |
| [README.md](README.md) | English documentation |

### 上游项目与许可证

在 [rag-web-ui/rag-web-ui](https://github.com/rag-web-ui/rag-web-ui) 基础上维护，遵循 **[Apache License 2.0](LICENSE)**。感谢上游作者及 FastAPI、LangChain、Next.js、Chroma、MinIO 等相关开源项目。
