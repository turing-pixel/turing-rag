import os
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

_CONFIG_FILE = Path(__file__).resolve()
_API_ROOT = _CONFIG_FILE.parents[2]


def _resolve_repo_root() -> Path:
    """Monorepo root (pnpm-workspace.yaml) or API root in Docker (/app)."""
    for parent in _CONFIG_FILE.parents:
        if (parent / "pnpm-workspace.yaml").is_file():
            return parent
    return _API_ROOT


_REPO_ROOT = _resolve_repo_root()


def _split_csv_urls(value: str) -> List[str]:
    out: List[str] = []
    for part in value.split(","):
        p = part.strip().rstrip("/")
        if p:
            out.append(p)
    return out


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            _REPO_ROOT / ".env",
            _API_ROOT / ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "RAG Web UI"  # Project name
    VERSION: str = "0.1.0"  # Project version
    API_V1_STR: str = "/api"  # API version string

    # PostgreSQL settings
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "db")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "ragwebui")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "ragwebui")
    POSTGRES_DATABASE: str = os.getenv("POSTGRES_DATABASE", "ragwebui")
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    @property
    def get_database_url(self) -> str:
        if self.SQLALCHEMY_DATABASE_URI:
            return self.SQLALCHEMY_DATABASE_URI
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DATABASE}"
        )

    # JWT settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

    # Chat Provider settings (credentials follow CHAT_PROVIDER via CHAT_API_* / CHAT_MODEL)
    CHAT_PROVIDER: str = os.getenv("CHAT_PROVIDER", "openai")
    CHAT_API_KEY: str = os.getenv("CHAT_API_KEY", "")
    CHAT_API_BASE: str = os.getenv("CHAT_API_BASE", "")
    CHAT_MODEL: str = os.getenv("CHAT_MODEL", "")

    # Embeddings settings (credentials follow EMBEDDINGS_PROVIDER via EMBEDDINGS_API_* / EMBEDDINGS_MODEL)
    EMBEDDINGS_PROVIDER: str = os.getenv("EMBEDDINGS_PROVIDER", "openai")
    EMBEDDINGS_API_KEY: str = os.getenv("EMBEDDINGS_API_KEY", "")
    EMBEDDINGS_API_BASE: str = os.getenv("EMBEDDINGS_API_BASE", "")
    EMBEDDINGS_MODEL: str = os.getenv("EMBEDDINGS_MODEL", "")

    # MinIO settings
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET_NAME: str = os.getenv("MINIO_BUCKET_NAME", "documents")

    # OpenAI settings
    OPENAI_API_BASE: str = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "your-openai-api-key-here")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4")
    OPENAI_EMBEDDINGS_MODEL: str = os.getenv("OPENAI_EMBEDDINGS_MODEL", "text-embedding-ada-002")

    # DashScope settings
    DASH_SCOPE_API_KEY: str = os.getenv("DASH_SCOPE_API_KEY", "")
    DASH_SCOPE_EMBEDDINGS_MODEL: str = os.getenv("DASH_SCOPE_EMBEDDINGS_MODEL", "")

    # Vector Store settings
    VECTOR_STORE_TYPE: str = os.getenv("VECTOR_STORE_TYPE", "chroma")
    # Optional retrieval filtering. By default scores are reported but not filtered.
    # Chroma/Qdrant LangChain score semantics commonly behave like distance
    # (lower is better), but this can be changed with RETRIEVAL_SCORE_MODE.
    RETRIEVAL_SCORE_THRESHOLD: str = os.getenv("RETRIEVAL_SCORE_THRESHOLD", "")
    RETRIEVAL_SCORE_MODE: str = os.getenv("RETRIEVAL_SCORE_MODE", "distance")

    @property
    def retrieval_score_threshold(self) -> Optional[float]:
        raw = (self.RETRIEVAL_SCORE_THRESHOLD or "").strip()
        if not raw:
            return None
        try:
            return float(raw)
        except ValueError:
            return None

    @property
    def retrieval_score_mode(self) -> str:
        mode = (self.RETRIEVAL_SCORE_MODE or "distance").strip().lower()
        return mode if mode in ("distance", "similarity") else "distance"

    # Chroma HTTP server (local: http://127.0.0.1:28100, prod: http://host.docker.internal:28100)
    CHROMA_URL: str = os.getenv("CHROMA_URL", "http://chromadb:8000")

    @property
    def chroma_host(self) -> str:
        """Host for chromadb.HttpClient (use 127.0.0.1 locally; macOS localhost may be IPv6-only)."""
        host = urlparse(self.CHROMA_URL.strip()).hostname
        if not host:
            raise ValueError(f"Invalid CHROMA_URL: {self.CHROMA_URL!r}")
        if host in ("localhost", "::1"):
            return "127.0.0.1"
        return host.strip("[]")

    @property
    def chroma_port(self) -> int:
        parsed = urlparse(self.CHROMA_URL.strip())
        if parsed.port is not None:
            return parsed.port
        return 443 if parsed.scheme == "https" else 80

    # Qdrant DB settings
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_PREFER_GRPC: bool = os.getenv("QDRANT_PREFER_GRPC", "true").lower() == "true"

    # Legacy per-provider chat (fallback when CHAT_* empty)
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_BASE: str = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

    MINIMAX_API_KEY: str = os.getenv("MINIMAX_API_KEY", "")
    MINIMAX_API_BASE: str = os.getenv("MINIMAX_API_BASE", "https://api.minimax.io/v1")
    MINIMAX_MODEL: str = os.getenv("MINIMAX_MODEL", "MiniMax-M2.7")

    OLLAMA_API_BASE: str = os.getenv("OLLAMA_API_BASE", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "deepseek-r1:7b")
    # Ollama embedding: bge-m3 (1024 dims, multilingual) or nomic-embed-text (768 dims, lightweight)
    OLLAMA_EMBEDDINGS_MODEL: str = os.getenv("OLLAMA_EMBEDDINGS_MODEL", "bge-m3")

    # HuggingFace settings
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    HUGGINGFACE_EMBEDDINGS_MODEL: str = os.getenv(
        "HUGGINGFACE_EMBEDDINGS_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )

    # Production: public web app URL (CORS). Optional extra origins (comma-separated).
    WEB_BASE_URL: str = os.getenv("WEB_BASE_URL", "")
    API_BASE_URL: str = os.getenv("API_BASE_URL", "")
    CORS_ALLOWED_ORIGINS: str = os.getenv("CORS_ALLOWED_ORIGINS", "")

    @property
    def cors_allow_origins(self) -> List[str]:
        # Browser Origin must match exactly. Include bare host (port 80 / reverse proxy).
        origins = [
            "http://localhost",
            "http://127.0.0.1",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:4567",
            "http://127.0.0.1:4567",
        ]
        if self.WEB_BASE_URL.strip():
            u = self.WEB_BASE_URL.strip().rstrip("/")
            origins.append(u)
        origins.extend(_split_csv_urls(self.CORS_ALLOWED_ORIGINS))
        return list(dict.fromkeys(origins))

    @property
    def cors_allow_origin_regex(self) -> Optional[str]:
        """LAN dev origins (e.g. http://192.168.x.x:3000 from Next.js Network URL)."""
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env not in ("development", "dev", "local"):
            return None
        return (
            r"https?://("
            r"localhost|127\.0\.0\.1"
            r"|192\.168\.\d{1,3}\.\d{1,3}"
            r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
            r")(:\d+)?$"
        )


settings = Settings()
