"""Resolve embedding credentials from unified EMBEDDINGS_* env vars (with legacy fallback)."""

from dataclasses import dataclass

from app.core.config import settings
from app.services.embedding.embedding_provider_registry import (
    get_embedding_provider_definition,
)

_PLACEHOLDER_KEYS = {
    "your-openai-api-key-here",
}


@dataclass(frozen=True)
class EmbeddingEnvCredentials:
    provider: str
    api_key: str
    api_base: str
    model: str


def embeddings_provider_id() -> str:
    return (settings.EMBEDDINGS_PROVIDER or "openai").lower()


def _has_api_key(key: str) -> bool:
    value = (key or "").strip()
    return bool(value) and value not in _PLACEHOLDER_KEYS


def _legacy_api_key(provider: str) -> str:
    provider = provider.lower()
    if provider == "openai":
        return (settings.OPENAI_API_KEY or "").strip()
    if provider == "dashscope":
        return (settings.DASH_SCOPE_API_KEY or "").strip()
    if provider == "huggingface":
        return (settings.HUGGINGFACE_API_KEY or "").strip()
    return ""


def _legacy_api_base(provider: str) -> str:
    provider = provider.lower()
    if provider == "openai":
        return (settings.OPENAI_API_BASE or "").strip()
    if provider == "ollama":
        return (settings.OLLAMA_API_BASE or "").strip()
    return ""


def _legacy_model(provider: str) -> str:
    provider = provider.lower()
    if provider == "openai":
        return (settings.OPENAI_EMBEDDINGS_MODEL or "").strip()
    if provider == "ollama":
        return (settings.OLLAMA_EMBEDDINGS_MODEL or "").strip()
    if provider == "dashscope":
        return (settings.DASH_SCOPE_EMBEDDINGS_MODEL or "").strip()
    if provider == "huggingface":
        return (settings.HUGGINGFACE_EMBEDDINGS_MODEL or "").strip()
    return ""


def resolve_embedding_credentials(
    provider: str | None = None,
) -> EmbeddingEnvCredentials:
    """Unified EMBEDDINGS_* vars apply to EMBEDDINGS_PROVIDER; legacy {PROVIDER}_* still supported."""
    resolved_provider = (provider or embeddings_provider_id()).lower()
    definition = get_embedding_provider_definition(resolved_provider)
    default_base = definition.default_api_base if definition else ""
    default_model = definition.default_model if definition else ""

    api_key = ""
    api_base = ""
    model = ""

    if resolved_provider == embeddings_provider_id():
        api_key = (settings.EMBEDDINGS_API_KEY or "").strip()
        api_base = (settings.EMBEDDINGS_API_BASE or "").strip()
        model = (settings.EMBEDDINGS_MODEL or "").strip()

    if not api_key:
        api_key = _legacy_api_key(resolved_provider)
    if not api_base:
        api_base = _legacy_api_base(resolved_provider)
    if not model:
        model = _legacy_model(resolved_provider)

    if not api_base:
        api_base = default_base
    if not model:
        model = default_model

    return EmbeddingEnvCredentials(
        provider=resolved_provider,
        api_key=api_key,
        api_base=api_base,
        model=model,
    )


def is_embedding_env_configured(provider: str | None = None) -> bool:
    resolved_provider = (provider or embeddings_provider_id()).lower()
    creds = resolve_embedding_credentials(resolved_provider)
    definition = get_embedding_provider_definition(resolved_provider)

    if resolved_provider == "ollama":
        return bool(creds.api_base.strip() and creds.model.strip())

    if definition and not definition.requires_api_key:
        return bool(creds.model.strip())

    return _has_api_key(creds.api_key) and bool(creds.model.strip())
