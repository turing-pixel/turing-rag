from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.llm_config import LlmConfig
from app.schemas.llm_config import LlmConfigCreate, LlmConfigUpdate
from app.services.llm.provider_registry import (
    get_provider_definition,
    list_provider_definitions,
)
from app.services.user_preference_service import (
    get_or_create_preferences,
    get_preferred_llm_config,
    is_llm_config_default,
    is_llm_env_default,
    repoint_llm_default_after_config_unavailable,
    set_llm_default_config,
    set_llm_default_env,
)


@dataclass
class ResolvedLlmRuntime:
    provider: str
    model: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    config_id: Optional[int] = None
    config_name: Optional[str] = None


def mask_api_key(api_key: Optional[str]) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "*" * len(api_key)
    return f"{'*' * (len(api_key) - 4)}{api_key[-4:]}"


def default_api_base_for_provider(provider: str) -> str:
    definition = get_provider_definition(provider)
    return definition.default_api_base if definition else ""


def default_model_for_provider(provider: str) -> str:
    definition = get_provider_definition(provider)
    return definition.default_model if definition else ""


def provider_requires_api_key(provider: str) -> bool:
    definition = get_provider_definition(provider)
    return definition.requires_api_key if definition else True


def get_env_default_llm_config(db: Session, user_id: int) -> dict:
    """Resolved CHAT_* / legacy env vars for read-only display."""
    from app.core.chat_env import is_chat_env_configured, resolve_chat_credentials

    if not is_chat_env_configured():
        return {"configured": False, "is_default": False}

    creds = resolve_chat_credentials()
    return {
        "configured": True,
        "is_default": is_llm_env_default(db, user_id),
        "provider": creds.provider,
        "model": creds.model,
        "api_base": creds.api_base or None,
        "api_key_masked": mask_api_key(creds.api_key) if creds.api_key else "",
    }


def set_env_default_llm_config(db: Session, user_id: int) -> None:
    set_llm_default_env(db, user_id)


def get_provider_metadata() -> list[dict]:
    return [
        {
            "provider": definition.id,
            "label": definition.label,
            "default_api_base": definition.default_api_base,
            "default_model": definition.default_model,
            "requires_api_key": definition.requires_api_key,
        }
        for definition in list_provider_definitions()
    ]


def to_response(config: LlmConfig, db: Session) -> dict:
    return {
        "id": config.id,
        "user_id": config.user_id,
        "name": config.name,
        "provider": config.provider,
        "model": config.model,
        "api_base": config.api_base,
        "api_key_masked": mask_api_key(config.api_key),
        "is_active": config.is_active,
        "is_default": is_llm_config_default(db, config.user_id, config.id),
        "created_at": config.created_at,
        "updated_at": config.updated_at,
    }


def get_llm_config(
    db: Session, config_id: int, user_id: Optional[int] = None
) -> Optional[LlmConfig]:
    query = db.query(LlmConfig).filter(LlmConfig.id == config_id)
    if user_id is not None:
        query = query.filter(LlmConfig.user_id == user_id)
    return query.first()


def list_llm_configs(
    db: Session, user_id: int, skip: int = 0, limit: int = 100
) -> List[LlmConfig]:
    configs = (
        db.query(LlmConfig)
        .filter(LlmConfig.user_id == user_id)
        .order_by(LlmConfig.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    get_or_create_preferences(db, user_id)

    def sort_key(item: LlmConfig) -> tuple:
        is_def = is_llm_config_default(db, user_id, item.id)
        return (0 if is_def else 1, -item.updated_at.timestamp())

    return sorted(configs, key=sort_key)


def create_llm_config(
    db: Session, user_id: int, data: LlmConfigCreate, *, skip_verify: bool = False
) -> LlmConfig:
    provider = data.provider.lower()
    if not get_provider_definition(provider):
        raise ValueError(f"Unsupported LLM provider: {provider}")

    if provider_requires_api_key(provider) and not (data.api_key or "").strip():
        raise ValueError("API key is required for this provider")

    if not skip_verify:
        from app.services.llm.llm_probe_service import verify_model_connection

        ok, message = verify_model_connection(
            db=db,
            user_id=user_id,
            provider=provider,
            model=data.model.strip() or default_model_for_provider(provider),
            api_base=data.api_base,
            api_key=data.api_key,
        )
        if not ok:
            raise ValueError(message)

    config = LlmConfig(
        user_id=user_id,
        name=data.name.strip(),
        provider=provider,
        model=data.model.strip() or default_model_for_provider(provider),
        api_base=(data.api_base or "").strip() or default_api_base_for_provider(provider),
        api_key=(data.api_key or "").strip() or None,
        is_active=data.is_active,
        is_default=False,
    )
    db.add(config)
    db.commit()
    db.refresh(config)

    if data.is_default:
        set_llm_default_config(db, user_id, config.id)

    return config


def update_llm_config(
    db: Session,
    config: LlmConfig,
    data: LlmConfigUpdate,
    *,
    skip_verify: bool = False,
) -> LlmConfig:
    payload = data.model_dump(exclude_unset=True)
    provider = (payload.get("provider") or config.provider).lower()

    if payload.get("provider") and not get_provider_definition(provider):
        raise ValueError(f"Unsupported LLM provider: {provider}")

    next_model = (
        payload["model"].strip() if payload.get("model") is not None else config.model
    )
    next_api_base = (
        (payload.get("api_base") or "").strip() or default_api_base_for_provider(provider)
        if "api_base" in payload
        else (config.api_base or default_api_base_for_provider(provider))
    )
    next_api_key = config.api_key
    if "api_key" in payload:
        api_key = (payload.get("api_key") or "").strip()
        if api_key:
            next_api_key = api_key

    credentials_changed = any(
        key in payload for key in ("provider", "model", "api_base", "api_key")
    )
    if not skip_verify and credentials_changed:
        from app.services.llm.llm_probe_service import verify_model_connection

        ok, message = verify_model_connection(
            db=db,
            user_id=config.user_id,
            provider=provider,
            model=next_model,
            api_base=next_api_base,
            api_key=next_api_key,
            config_id=config.id,
        )
        if not ok:
            raise ValueError(message)

    if provider_requires_api_key(provider) and not next_api_key:
        raise ValueError("API key is required for this provider")

    if "name" in payload and payload["name"] is not None:
        config.name = payload["name"].strip()
    if "provider" in payload and payload["provider"] is not None:
        config.provider = provider
    if "model" in payload and payload["model"] is not None:
        config.model = payload["model"].strip()
    if "api_base" in payload:
        config.api_base = (payload["api_base"] or "").strip() or default_api_base_for_provider(
            provider
        )

    was_active = config.is_active
    if "is_active" in payload and payload["is_active"] is not None:
        config.is_active = payload["is_active"]

    if "is_default" in payload and payload["is_default"] is not None:
        if payload["is_default"]:
            if not config.is_active:
                raise ValueError("Cannot set a disabled configuration as default")
            set_llm_default_config(db, config.user_id, config.id)
        elif is_llm_config_default(db, config.user_id, config.id):
            from app.core.chat_env import is_chat_env_configured

            if is_chat_env_configured():
                set_llm_default_env(db, config.user_id)
            else:
                raise ValueError(
                    "Cannot clear default without another active configuration or env chat model"
                )

    if was_active and not config.is_active:
        repoint_llm_default_after_config_unavailable(db, config.user_id, config.id)

    config.is_default = False
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def delete_llm_config(db: Session, config: LlmConfig) -> None:
    user_id = config.user_id
    config_id = config.id
    was_default = is_llm_config_default(db, user_id, config_id)
    db.delete(config)
    db.commit()

    if was_default:
        repoint_llm_default_after_config_unavailable(db, user_id, config_id)


def get_user_default_config(db: Session, user_id: int) -> Optional[LlmConfig]:
    return get_preferred_llm_config(db, user_id)


def _runtime_from_env_settings(provider: str, model: str) -> ResolvedLlmRuntime:
    from app.core.chat_env import resolve_chat_credentials

    creds = resolve_chat_credentials(provider)
    resolved_model = model or creds.model
    api_key = creds.api_key or None
    api_base = creds.api_base or None
    if provider == "ollama" and not api_key:
        api_key = None

    return ResolvedLlmRuntime(
        provider=provider,
        model=resolved_model,
        api_key=api_key,
        api_base=api_base,
    )


def resolve_runtime_config(
    db: Session,
    user_id: int,
    llm_config_id: Optional[int] = None,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> ResolvedLlmRuntime:
    if llm_config_id is not None:
        config = get_llm_config(db, llm_config_id, user_id=user_id)
        if not config:
            raise ValueError("LLM configuration not found")
        if not config.is_active:
            raise ValueError("LLM configuration is disabled")
        return ResolvedLlmRuntime(
            provider=config.provider,
            model=config.model,
            api_key=config.api_key,
            api_base=config.api_base or default_api_base_for_provider(config.provider),
            config_id=config.id,
            config_name=config.name,
        )

    if llm_provider and llm_model:
        provider_lower = llm_provider.lower()
        if llm_config_id is None:
            from app.core.chat_env import is_chat_env_configured
            from app.services.llm.llm_models import validate_llm_config

            if is_chat_env_configured(provider_lower):
                provider, model = validate_llm_config(
                    provider_lower, llm_model, db=db, user_id=user_id
                )
                return _runtime_from_env_settings(provider, model)

        config = (
            db.query(LlmConfig)
            .filter(
                LlmConfig.user_id == user_id,
                LlmConfig.provider == provider_lower,
                LlmConfig.model == llm_model,
                LlmConfig.is_active.is_(True),
            )
            .first()
        )
        if config:
            return resolve_runtime_config(db, user_id, llm_config_id=config.id)

        from app.core.chat_env import is_chat_env_configured
        from app.services.llm.llm_models import validate_llm_config

        if is_chat_env_configured(provider_lower):
            provider, model = validate_llm_config(
                provider_lower, llm_model, db=db, user_id=user_id
            )
            return _runtime_from_env_settings(provider, model)

    if llm_config_id is None and not (llm_provider and llm_model):
        default_config = get_preferred_llm_config(db, user_id)
        if default_config:
            return resolve_runtime_config(db, user_id, llm_config_id=default_config.id)

        from app.core.chat_env import is_chat_env_configured

        if is_llm_env_default(db, user_id) and is_chat_env_configured():
            from app.core.chat_env import resolve_chat_credentials

            creds = resolve_chat_credentials()
            return _runtime_from_env_settings(creds.provider, creds.model)

    from app.services.llm.llm_models import validate_llm_config

    provider, model = validate_llm_config(llm_provider, llm_model, db=db, user_id=user_id)
    return _runtime_from_env_settings(provider, model)
