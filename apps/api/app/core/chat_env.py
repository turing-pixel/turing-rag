"""Resolve chat LLM credentials from unified CHAT_* env vars (with legacy per-provider fallback)."""

from dataclasses import dataclass

from app.core.config import settings
from app.services.llm.provider_registry import get_provider_definition

_PLACEHOLDER_KEYS = {
    "your-openai-api-key-here",
    "your-deepseek-api-key-here",
    "your-minimax-api-key-here",
}


@dataclass(frozen=True)
class ChatEnvCredentials:
    provider: str
    api_key: str
    api_base: str
    model: str


def chat_provider_id() -> str:
    return (settings.CHAT_PROVIDER or "openai").lower()


def _has_api_key(key: str) -> bool:
    value = (key or "").strip()
    return bool(value) and value not in _PLACEHOLDER_KEYS


def _legacy_api_key(provider: str) -> str:
    provider = provider.lower()
    if provider == "openai":
        return (settings.OPENAI_API_KEY or "").strip()
    if provider == "deepseek":
        return (settings.DEEPSEEK_API_KEY or "").strip()
    if provider == "minimax":
        return (settings.MINIMAX_API_KEY or "").strip()
    return ""


def _legacy_api_base(provider: str) -> str:
    provider = provider.lower()
    if provider == "openai":
        return (settings.OPENAI_API_BASE or "").strip()
    if provider == "deepseek":
        return (settings.DEEPSEEK_API_BASE or "").strip()
    if provider == "minimax":
        return (settings.MINIMAX_API_BASE or "").strip()
    if provider == "ollama":
        return (settings.OLLAMA_API_BASE or "").strip()
    return ""


def _legacy_model(provider: str) -> str:
    provider = provider.lower()
    if provider == "openai":
        return (settings.OPENAI_MODEL or "").strip()
    if provider == "deepseek":
        return (settings.DEEPSEEK_MODEL or "").strip()
    if provider == "minimax":
        return (settings.MINIMAX_MODEL or "").strip()
    if provider == "ollama":
        return (settings.OLLAMA_MODEL or "").strip()
    return ""


def resolve_chat_credentials(
    provider: str | None = None,
) -> ChatEnvCredentials:
    """Unified CHAT_* vars apply to the active CHAT_PROVIDER; legacy {PROVIDER}_* still supported."""
    resolved_provider = (provider or chat_provider_id()).lower()
    definition = get_provider_definition(resolved_provider)
    default_base = definition.default_api_base if definition else ""
    default_model = definition.default_model if definition else ""

    api_key = ""
    api_base = ""
    model = ""

    if resolved_provider == chat_provider_id():
        api_key = (settings.CHAT_API_KEY or "").strip()
        api_base = (settings.CHAT_API_BASE or "").strip()
        model = (settings.CHAT_MODEL or "").strip()

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

    return ChatEnvCredentials(
        provider=resolved_provider,
        api_key=api_key,
        api_base=api_base,
        model=model,
    )


def is_chat_env_configured(provider: str | None = None) -> bool:
    resolved_provider = (provider or chat_provider_id()).lower()
    creds = resolve_chat_credentials(resolved_provider)
    if resolved_provider == "ollama":
        return bool(creds.api_base.strip() and creds.model.strip())
    definition = get_provider_definition(resolved_provider)
    if definition and definition.factory == "openai_compatible":
        return _has_api_key(creds.api_key) and bool(creds.api_base.strip())
    if definition and not definition.requires_api_key:
        return bool(creds.api_base.strip())
    return _has_api_key(creds.api_key) and bool(creds.model.strip())
