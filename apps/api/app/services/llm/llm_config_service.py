from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.llm_config import LlmConfig
from app.schemas.llm_config import LlmConfigCreate, LlmConfigUpdate
from app.services.llm.provider_registry import (
    get_provider_definition,
    list_provider_definitions,
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


def to_response(config: LlmConfig) -> dict:
    definition = get_provider_definition(config.provider)
    return {
        "id": config.id,
        "user_id": config.user_id,
        "name": config.name,
        "provider": config.provider,
        "model": config.model,
        "api_base": config.api_base,
        "api_key_masked": mask_api_key(config.api_key),
        "is_active": config.is_active,
        "is_default": config.is_default,
        "created_at": config.created_at,
        "updated_at": config.updated_at,
    }


def _clear_other_defaults(db: Session, user_id: int, exclude_id: Optional[int] = None) -> None:
    query = db.query(LlmConfig).filter(
        LlmConfig.user_id == user_id,
        LlmConfig.is_default.is_(True),
    )
    if exclude_id is not None:
        query = query.filter(LlmConfig.id != exclude_id)
    for item in query.all():
        item.is_default = False


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
    return (
        db.query(LlmConfig)
        .filter(LlmConfig.user_id == user_id)
        .order_by(LlmConfig.is_default.desc(), LlmConfig.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


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

    if data.is_default:
        _clear_other_defaults(db, user_id)

    config = LlmConfig(
        user_id=user_id,
        name=data.name.strip(),
        provider=provider,
        model=data.model.strip() or default_model_for_provider(provider),
        api_base=(data.api_base or "").strip() or default_api_base_for_provider(provider),
        api_key=(data.api_key or "").strip() or None,
        is_active=data.is_active,
        is_default=data.is_default,
    )
    db.add(config)
    db.commit()
    db.refresh(config)

    if not db.query(LlmConfig).filter(
        LlmConfig.user_id == user_id, LlmConfig.is_default.is_(True)
    ).first():
        config.is_default = True
        db.add(config)
        db.commit()
        db.refresh(config)

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
        payload["model"].strip()
        if payload.get("model") is not None
        else config.model
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

    if "api_key" in payload:
        api_key = (payload.pop("api_key") or "").strip()
        if api_key:
            config.api_key = api_key
    elif provider_requires_api_key(provider) and not config.api_key:
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
    if "is_active" in payload and payload["is_active"] is not None:
        config.is_active = payload["is_active"]
    if "is_default" in payload and payload["is_default"] is not None:
        if payload["is_default"]:
            _clear_other_defaults(db, config.user_id, exclude_id=config.id)
        config.is_default = payload["is_default"]

    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def delete_llm_config(db: Session, config: LlmConfig) -> None:
    was_default = config.is_default
    user_id = config.user_id
    db.delete(config)
    db.commit()

    if was_default:
        replacement = (
            db.query(LlmConfig)
            .filter(LlmConfig.user_id == user_id, LlmConfig.is_active.is_(True))
            .order_by(LlmConfig.updated_at.desc())
            .first()
        )
        if replacement:
            replacement.is_default = True
            db.add(replacement)
            db.commit()


def get_user_default_config(db: Session, user_id: int) -> Optional[LlmConfig]:
    default = (
        db.query(LlmConfig)
        .filter(
            LlmConfig.user_id == user_id,
            LlmConfig.is_active.is_(True),
            LlmConfig.is_default.is_(True),
        )
        .first()
    )
    if default:
        return default
    return (
        db.query(LlmConfig)
        .filter(LlmConfig.user_id == user_id, LlmConfig.is_active.is_(True))
        .order_by(LlmConfig.updated_at.desc())
        .first()
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
        config = (
            db.query(LlmConfig)
            .filter(
                LlmConfig.user_id == user_id,
                LlmConfig.provider == llm_provider.lower(),
                LlmConfig.model == llm_model,
                LlmConfig.is_active.is_(True),
            )
            .first()
        )
        if config:
            return resolve_runtime_config(db, user_id, llm_config_id=config.id)

    default_config = get_user_default_config(db, user_id)
    if default_config:
        return resolve_runtime_config(db, user_id, llm_config_id=default_config.id)

    from app.services.llm.llm_models import validate_llm_config

    provider, model = validate_llm_config(llm_provider, llm_model, db=db, user_id=user_id)
    definition = get_provider_definition(provider)
    api_key = None
    api_base = definition.default_api_base if definition else None

    if provider == "openai":
        from app.core.config import settings

        api_key = settings.OPENAI_API_KEY
        api_base = settings.OPENAI_API_BASE
    elif provider == "deepseek":
        from app.core.config import settings

        api_key = settings.DEEPSEEK_API_KEY
        api_base = settings.DEEPSEEK_API_BASE
    elif provider == "minimax":
        from app.core.config import settings

        api_key = settings.MINIMAX_API_KEY
        api_base = settings.MINIMAX_API_BASE

    return ResolvedLlmRuntime(provider=provider, model=model, api_key=api_key, api_base=api_base)
