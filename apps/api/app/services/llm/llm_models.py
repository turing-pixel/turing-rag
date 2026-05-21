from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.llm_config import LlmConfig
from app.services.llm.llm_config_service import (
    ResolvedLlmRuntime,
    get_user_default_config,
    resolve_runtime_config,
)
from app.services.llm.provider_registry import (
    SUPPORTED_LLM_PROVIDERS,
    get_provider_definition,
    list_provider_definitions,
)

_PLACEHOLDER_KEYS = {
    "your-openai-api-key-here",
    "your-deepseek-api-key-here",
    "your-minimax-api-key-here",
}


class LlmModelOption(BaseModel):
    provider: str
    model: str
    label: str
    is_default: bool = False
    config_id: Optional[int] = None


class LlmProviderOption(BaseModel):
    provider: str
    label: str
    models: List[LlmModelOption]


def _has_api_key(key: str) -> bool:
    value = (key or "").strip()
    return bool(value) and value not in _PLACEHOLDER_KEYS


def _provider_configured(provider: str) -> bool:
    provider = provider.lower()
    if provider == "openai":
        return _has_api_key(settings.OPENAI_API_KEY)
    if provider == "deepseek":
        return _has_api_key(settings.DEEPSEEK_API_KEY)
    if provider == "minimax":
        return _has_api_key(settings.MINIMAX_API_KEY)
    if provider == "ollama":
        return bool((settings.OLLAMA_API_BASE or "").strip())
    return False


def _catalog_models(provider: str) -> list[tuple[str, str]]:
    definition = get_provider_definition(provider)
    if not definition:
        return []

    catalog = list(definition.catalog_models)
    default_model = definition.default_model
    if default_model and not any(model_id == default_model for model_id, _ in catalog):
        catalog.insert(0, (default_model, default_model))
    return catalog


def get_default_llm_config(
    db: Optional[Session] = None, user_id: Optional[int] = None
) -> tuple[str, str]:
    if db is not None and user_id is not None:
        default_config = get_user_default_config(db, user_id)
        if default_config:
            return default_config.provider, default_config.model

    for definition in list_provider_definitions():
        if _provider_configured(definition.id):
            return definition.id, definition.default_model

    fallback = get_provider_definition((settings.CHAT_PROVIDER or "openai").lower())
    if fallback:
        return fallback.id, fallback.default_model
    return "openai", settings.OPENAI_MODEL


def _providers_from_env() -> List[LlmProviderOption]:
    providers: List[LlmProviderOption] = []
    default_provider, default_model = get_default_llm_config()

    for definition in list_provider_definitions():
        if not _provider_configured(definition.id):
            continue

        model_entries = _catalog_models(definition.id)
        models: List[LlmModelOption] = []
        seen: set[str] = set()
        for model_id, label in model_entries:
            if model_id in seen:
                continue
            seen.add(model_id)
            models.append(
                LlmModelOption(
                    provider=definition.id,
                    model=model_id,
                    label=label,
                    is_default=(
                        definition.id == default_provider and model_id == default_model
                    ),
                )
            )

        if definition.id == "ollama" and not models:
            models.append(
                LlmModelOption(
                    provider=definition.id,
                    model=definition.default_model,
                    label=definition.default_model,
                    is_default=definition.id == default_provider,
                )
            )

        providers.append(
            LlmProviderOption(
                provider=definition.id,
                label=definition.label,
                models=models,
            )
        )

    return providers


def _providers_from_db(db: Session, user_id: int) -> List[LlmProviderOption]:
    configs = (
        db.query(LlmConfig)
        .filter(LlmConfig.user_id == user_id, LlmConfig.is_active.is_(True))
        .order_by(LlmConfig.is_default.desc(), LlmConfig.name.asc())
        .all()
    )
    if not configs:
        return []

    default_config = get_user_default_config(db, user_id)
    grouped: dict[str, LlmProviderOption] = {}

    for config in configs:
        definition = get_provider_definition(config.provider)
        if config.provider not in grouped:
            grouped[config.provider] = LlmProviderOption(
                provider=config.provider,
                label=definition.label if definition else config.provider,
                models=[],
            )
        grouped[config.provider].models.append(
            LlmModelOption(
                provider=config.provider,
                model=config.model,
                label=config.name,
                is_default=default_config is not None and config.id == default_config.id,
                config_id=config.id,
            )
        )

    return list(grouped.values())


def get_available_llm_providers(
    db: Optional[Session] = None, user_id: Optional[int] = None
) -> List[LlmProviderOption]:
    if db is not None and user_id is not None:
        db_providers = _providers_from_db(db, user_id)
        if db_providers:
            return db_providers
    return _providers_from_env()


def validate_llm_config(
    provider: Optional[str],
    model: Optional[str],
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    llm_config_id: Optional[int] = None,
) -> tuple[str, str]:
    if db is not None and user_id is not None:
        if llm_config_id is not None:
            runtime = resolve_runtime_config(db, user_id, llm_config_id=llm_config_id)
            return runtime.provider, runtime.model

        if provider and model:
            match = (
                db.query(LlmConfig)
                .filter(
                    LlmConfig.user_id == user_id,
                    LlmConfig.provider == provider.lower(),
                    LlmConfig.model == model,
                    LlmConfig.is_active.is_(True),
                )
                .first()
            )
            if match:
                return match.provider, match.model

    resolved_provider, resolved_model = get_default_llm_config(db, user_id)
    if provider:
        resolved_provider = provider.lower()
    if model:
        resolved_model = model

    if resolved_provider not in SUPPORTED_LLM_PROVIDERS:
        raise ValueError(f"Unsupported LLM provider: {resolved_provider}")

    if db is not None and user_id is not None:
        allowed_models = {
            option.model
            for option in get_available_llm_providers(db, user_id)
            for option in option.models
        }
        if allowed_models and resolved_model not in allowed_models:
            raise ValueError(
                f"Model '{resolved_model}' is not available for provider '{resolved_provider}'"
            )
        return resolved_provider, resolved_model

    if not _provider_configured(resolved_provider):
        raise ValueError(f"LLM provider is not configured: {resolved_provider}")

    allowed_models = {
        option.model
        for option in get_available_llm_providers()
        if option.provider == resolved_provider
        for option in option.models
    }
    if allowed_models and resolved_model not in allowed_models:
        raise ValueError(
            f"Model '{resolved_model}' is not available for provider '{resolved_provider}'"
        )

    return resolved_provider, resolved_model


def resolve_chat_llm_runtime(
    db: Session,
    user_id: int,
    llm_config_id: Optional[int] = None,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> ResolvedLlmRuntime:
    return resolve_runtime_config(
        db,
        user_id,
        llm_config_id=llm_config_id,
        llm_provider=llm_provider,
        llm_model=llm_model,
    )
