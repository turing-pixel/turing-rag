from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.chat_env import (
    chat_provider_id,
    is_chat_env_configured,
    resolve_chat_credentials,
)
from app.models.llm_config import LlmConfig
from app.services.llm.llm_config_service import (
    ResolvedLlmRuntime,
    get_user_default_config,
    resolve_runtime_config,
)
from app.services.user_preference_service import is_llm_env_default
from app.services.llm.provider_registry import (
    SUPPORTED_LLM_PROVIDERS,
    get_provider_definition,
    list_provider_definitions,
)

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


def get_default_llm_config(
    db: Optional[Session] = None, user_id: Optional[int] = None
) -> tuple[str, str]:
    if db is not None and user_id is not None:
        default_config = get_user_default_config(db, user_id)
        if default_config:
            return default_config.provider, default_config.model

        if is_llm_env_default(db, user_id):
            provider = chat_provider_id()
            if is_chat_env_configured(provider):
                creds = resolve_chat_credentials(provider)
                if creds.model:
                    return creds.provider, creds.model

    provider = chat_provider_id()
    if is_chat_env_configured(provider):
        creds = resolve_chat_credentials(provider)
        if creds.model:
            return creds.provider, creds.model

    fallback = get_provider_definition(provider)
    if fallback:
        return fallback.id, fallback.default_model
    return provider, "gpt-4"


def _providers_from_env(
    db: Optional[Session] = None, user_id: Optional[int] = None
) -> List[LlmProviderOption]:
    """Expose the active CHAT_PROVIDER from unified CHAT_* (or legacy) env vars."""
    provider = chat_provider_id()
    if not is_chat_env_configured(provider):
        return []

    creds = resolve_chat_credentials(provider)
    if not creds.model:
        return []

    definition = get_provider_definition(provider)
    label = definition.label if definition else provider
    default_provider, default_model = get_default_llm_config(db, user_id)

    return [
        LlmProviderOption(
            provider=provider,
            label=label,
            models=[
                LlmModelOption(
                    provider=provider,
                    model=creds.model,
                    label=creds.model,
                    is_default=provider == default_provider and creds.model == default_model,
                )
            ],
        )
    ]


def _providers_from_db(db: Session, user_id: int) -> List[LlmProviderOption]:
    configs = (
        db.query(LlmConfig)
        .filter(LlmConfig.user_id == user_id, LlmConfig.is_active.is_(True))
        .order_by(LlmConfig.name.asc())
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


def _db_model_keys(providers: List[LlmProviderOption]) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    for provider in providers:
        for model in provider.models:
            if model.config_id is not None:
                keys.add((provider.provider, model.model))
    return keys


def _merge_providers(
    db_providers: List[LlmProviderOption], env_providers: List[LlmProviderOption]
) -> List[LlmProviderOption]:
    """Merge user DB configs with environment-backed catalog; DB entries take precedence."""
    if not db_providers:
        return env_providers
    if not env_providers:
        return db_providers

    db_keys = _db_model_keys(db_providers)
    has_db_default = any(
        model.is_default
        for provider in db_providers
        for model in provider.models
        if model.config_id is not None
    )

    merged: dict[str, LlmProviderOption] = {
        provider.provider: LlmProviderOption(
            provider=provider.provider,
            label=provider.label,
            models=list(provider.models),
        )
        for provider in db_providers
    }

    for env_provider in env_providers:
        if env_provider.provider not in merged:
            env_models = list(env_provider.models)
            if has_db_default:
                env_models = [
                    LlmModelOption(
                        provider=model.provider,
                        model=model.model,
                        label=model.label,
                        is_default=False,
                        config_id=model.config_id,
                    )
                    for model in env_models
                ]
            merged[env_provider.provider] = LlmProviderOption(
                provider=env_provider.provider,
                label=env_provider.label,
                models=env_models,
            )
            continue

        target = merged[env_provider.provider]
        existing_models = {model.model for model in target.models}
        for env_model in env_provider.models:
            if (env_provider.provider, env_model.model) in db_keys:
                continue
            if env_model.model in existing_models:
                continue
            target.models.append(
                LlmModelOption(
                    provider=env_model.provider,
                    model=env_model.model,
                    label=env_model.label,
                    is_default=False if has_db_default else env_model.is_default,
                    config_id=None,
                )
            )
            existing_models.add(env_model.model)

    return list(merged.values())


def get_available_llm_providers(
    db: Optional[Session] = None, user_id: Optional[int] = None
) -> List[LlmProviderOption]:
    env_providers = _providers_from_env(db, user_id)
    if db is not None and user_id is not None:
        db_providers = _providers_from_db(db, user_id)
        return _merge_providers(db_providers, env_providers)
    return env_providers


def _allowed_models_for_provider(
    providers: List[LlmProviderOption], provider: str
) -> set[str]:
    return {
        model.model
        for item in providers
        if item.provider == provider
        for model in item.models
    }


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
        providers = get_available_llm_providers(db, user_id)
        allowed_models = _allowed_models_for_provider(providers, resolved_provider)
        if allowed_models and resolved_model not in allowed_models:
            raise ValueError(
                f"Model '{resolved_model}' is not available for provider '{resolved_provider}'"
            )
        return resolved_provider, resolved_model

    from app.core.chat_env import is_chat_env_configured

    if not is_chat_env_configured(resolved_provider):
        raise ValueError(f"LLM provider is not configured: {resolved_provider}")

    allowed_models = _allowed_models_for_provider(
        get_available_llm_providers(), resolved_provider
    )
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
