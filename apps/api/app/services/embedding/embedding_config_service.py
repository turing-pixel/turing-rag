from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.embedding_config import EmbeddingConfig
from app.schemas.embedding_config import EmbeddingConfigCreate, EmbeddingConfigUpdate
from app.services.embedding.embedding_provider_registry import (
    get_embedding_provider_definition,
    list_embedding_provider_definitions,
)
from app.services.user_preference_service import (
    get_or_create_preferences,
    get_preferred_embedding_config,
    is_embedding_config_default,
    is_embedding_env_default,
    repoint_embedding_default_after_config_unavailable,
    set_embedding_default_config,
    set_embedding_default_env,
)


@dataclass
class ResolvedEmbeddingRuntime:
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
    definition = get_embedding_provider_definition(provider)
    return definition.default_api_base if definition else ""


def default_model_for_provider(provider: str) -> str:
    definition = get_embedding_provider_definition(provider)
    return definition.default_model if definition else ""


def provider_requires_api_key(provider: str) -> bool:
    definition = get_embedding_provider_definition(provider)
    return definition.requires_api_key if definition else True


def get_env_default_embedding_config(db: Session, user_id: int) -> dict:
    """Resolved EMBEDDINGS_* / legacy env vars for read-only display."""
    from app.core.embedding_env import (
        is_embedding_env_configured,
        resolve_embedding_credentials,
    )

    if not is_embedding_env_configured():
        return {"configured": False, "is_default": False}

    creds = resolve_embedding_credentials()
    return {
        "configured": True,
        "is_default": is_embedding_env_default(db, user_id),
        "provider": creds.provider,
        "model": creds.model,
        "api_base": creds.api_base or None,
        "api_key_masked": mask_api_key(creds.api_key) if creds.api_key else "",
    }


def set_env_default_embedding_config(db: Session, user_id: int) -> None:
    set_embedding_default_env(db, user_id)


def get_provider_metadata() -> list[dict]:
    return [
        {
            "provider": definition.id,
            "label": definition.label,
            "default_api_base": definition.default_api_base,
            "default_model": definition.default_model,
            "requires_api_key": definition.requires_api_key,
        }
        for definition in list_embedding_provider_definitions()
    ]


def to_response(config: EmbeddingConfig, db: Session) -> dict:
    return {
        "id": config.id,
        "user_id": config.user_id,
        "name": config.name,
        "provider": config.provider,
        "model": config.model,
        "api_base": config.api_base,
        "api_key_masked": mask_api_key(config.api_key),
        "is_active": config.is_active,
        "is_default": is_embedding_config_default(db, config.user_id, config.id),
        "created_at": config.created_at,
        "updated_at": config.updated_at,
    }


def get_embedding_config(
    db: Session, config_id: int, user_id: Optional[int] = None
) -> Optional[EmbeddingConfig]:
    query = db.query(EmbeddingConfig).filter(EmbeddingConfig.id == config_id)
    if user_id is not None:
        query = query.filter(EmbeddingConfig.user_id == user_id)
    return query.first()


def list_embedding_configs(
    db: Session, user_id: int, skip: int = 0, limit: int = 100
) -> List[EmbeddingConfig]:
    configs = (
        db.query(EmbeddingConfig)
        .filter(EmbeddingConfig.user_id == user_id)
        .order_by(EmbeddingConfig.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    get_or_create_preferences(db, user_id)

    def sort_key(item: EmbeddingConfig) -> tuple:
        is_def = is_embedding_config_default(db, user_id, item.id)
        return (0 if is_def else 1, -item.updated_at.timestamp())

    return sorted(configs, key=sort_key)


def create_embedding_config(
    db: Session, user_id: int, data: EmbeddingConfigCreate, *, skip_verify: bool = False
) -> EmbeddingConfig:
    provider = data.provider.lower()
    if not get_embedding_provider_definition(provider):
        raise ValueError(f"Unsupported embedding provider: {provider}")

    if provider_requires_api_key(provider) and not (data.api_key or "").strip():
        raise ValueError("API key is required for this provider")

    if not skip_verify:
        from app.services.embedding.embedding_probe_service import (
            verify_embedding_connection,
        )

        ok, message = verify_embedding_connection(
            db=db,
            user_id=user_id,
            provider=provider,
            model=data.model.strip() or default_model_for_provider(provider),
            api_base=data.api_base,
            api_key=data.api_key,
        )
        if not ok:
            raise ValueError(message)

    config = EmbeddingConfig(
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
        set_embedding_default_config(db, user_id, config.id)

    return config


def update_embedding_config(
    db: Session,
    config: EmbeddingConfig,
    data: EmbeddingConfigUpdate,
    *,
    skip_verify: bool = False,
) -> EmbeddingConfig:
    payload = data.model_dump(exclude_unset=True)
    provider = (payload.get("provider") or config.provider).lower()

    if payload.get("provider") and not get_embedding_provider_definition(provider):
        raise ValueError(f"Unsupported embedding provider: {provider}")

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
        from app.services.embedding.embedding_probe_service import (
            verify_embedding_connection,
        )

        ok, message = verify_embedding_connection(
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
        config.api_base = next_api_base or None

    was_active = config.is_active
    if "is_active" in payload and payload["is_active"] is not None:
        config.is_active = payload["is_active"]

    if "is_default" in payload and payload["is_default"] is not None:
        if payload["is_default"]:
            if not config.is_active:
                raise ValueError("Cannot set a disabled configuration as default")
            set_embedding_default_config(db, config.user_id, config.id)
        elif is_embedding_config_default(db, config.user_id, config.id):
            from app.core.embedding_env import is_embedding_env_configured

            if is_embedding_env_configured():
                set_embedding_default_env(db, config.user_id)
            else:
                raise ValueError(
                    "Cannot clear default without another active configuration or env embedding model"
                )

    if was_active and not config.is_active:
        repoint_embedding_default_after_config_unavailable(
            db, config.user_id, config.id
        )

    config.is_default = False
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def delete_embedding_config(db: Session, config: EmbeddingConfig) -> None:
    user_id = config.user_id
    config_id = config.id
    was_default = is_embedding_config_default(db, user_id, config_id)
    db.delete(config)
    db.commit()

    if was_default:
        repoint_embedding_default_after_config_unavailable(db, user_id, config_id)


def get_user_default_config(db: Session, user_id: int) -> Optional[EmbeddingConfig]:
    return get_preferred_embedding_config(db, user_id)


def resolve_embedding_runtime(
    db: Session,
    user_id: int,
    embedding_config_id: Optional[int] = None,
) -> ResolvedEmbeddingRuntime:
    if embedding_config_id is not None:
        config = get_embedding_config(db, embedding_config_id, user_id=user_id)
        if not config:
            raise ValueError("Embedding configuration not found")
        if not config.is_active:
            raise ValueError("Embedding configuration is disabled")
        return ResolvedEmbeddingRuntime(
            provider=config.provider,
            model=config.model,
            api_key=config.api_key,
            api_base=config.api_base or default_api_base_for_provider(config.provider),
            config_id=config.id,
            config_name=config.name,
        )

    default_config = get_preferred_embedding_config(db, user_id)
    if default_config:
        return resolve_embedding_runtime(db, user_id, embedding_config_id=default_config.id)

    from app.core.embedding_env import is_embedding_env_configured, resolve_embedding_credentials

    if is_embedding_env_default(db, user_id) and is_embedding_env_configured():
        creds = resolve_embedding_credentials()
        return ResolvedEmbeddingRuntime(
            provider=creds.provider,
            model=creds.model,
            api_key=creds.api_key or None,
            api_base=creds.api_base or None,
        )

    fallback = (
        db.query(EmbeddingConfig)
        .filter(EmbeddingConfig.user_id == user_id, EmbeddingConfig.is_active.is_(True))
        .order_by(EmbeddingConfig.updated_at.desc())
        .first()
    )
    if fallback:
        return resolve_embedding_runtime(db, user_id, embedding_config_id=fallback.id)

    raise ValueError(
        "No embedding model configured. Add an embedding configuration or set EMBEDDINGS_* in the environment."
    )


def embedding_runtime_cache_key(runtime: ResolvedEmbeddingRuntime) -> str:
    source = f"config:{runtime.config_id}" if runtime.config_id is not None else "env"
    return "|".join(
        [
            source,
            runtime.provider or "",
            runtime.model or "",
            runtime.api_base or "",
        ]
    )


def create_user_embeddings_with_runtime(db: Session, user_id: int):
    from app.services.embedding.embedding_factory import EmbeddingsFactory

    runtime = resolve_embedding_runtime(db, user_id)
    return EmbeddingsFactory.create(runtime), runtime


def create_user_embeddings(db: Session, user_id: int):
    embeddings, _runtime = create_user_embeddings_with_runtime(db, user_id)
    return embeddings
