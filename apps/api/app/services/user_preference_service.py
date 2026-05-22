from typing import Optional

from sqlalchemy.orm import Session

from app.models.embedding_config import EmbeddingConfig
from app.models.llm_config import LlmConfig
from app.models.user_preference import (
    DEFAULT_SOURCE_CONFIG,
    DEFAULT_SOURCE_ENV,
    UserPreference,
)


def get_or_create_preferences(db: Session, user_id: int) -> UserPreference:
    prefs = (
        db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    )
    if prefs is not None:
        return prefs

    prefs = UserPreference(
        user_id=user_id,
        default_llm_source=DEFAULT_SOURCE_ENV,
        default_embedding_source=DEFAULT_SOURCE_ENV,
    )
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def is_llm_env_default(db: Session, user_id: int) -> bool:
    prefs = get_or_create_preferences(db, user_id)
    return prefs.default_llm_source == DEFAULT_SOURCE_ENV


def is_embedding_env_default(db: Session, user_id: int) -> bool:
    prefs = get_or_create_preferences(db, user_id)
    return prefs.default_embedding_source == DEFAULT_SOURCE_ENV


def is_llm_config_default(db: Session, user_id: int, config_id: int) -> bool:
    prefs = get_or_create_preferences(db, user_id)
    return (
        prefs.default_llm_source == DEFAULT_SOURCE_CONFIG
        and prefs.default_llm_config_id == config_id
    )


def is_embedding_config_default(db: Session, user_id: int, config_id: int) -> bool:
    prefs = get_or_create_preferences(db, user_id)
    return (
        prefs.default_embedding_source == DEFAULT_SOURCE_CONFIG
        and prefs.default_embedding_config_id == config_id
    )


def set_llm_default_env(db: Session, user_id: int) -> UserPreference:
    from app.core.chat_env import is_chat_env_configured

    if not is_chat_env_configured():
        raise ValueError("System chat model is not configured")

    prefs = get_or_create_preferences(db, user_id)
    prefs.default_llm_source = DEFAULT_SOURCE_ENV
    prefs.default_llm_config_id = None
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def set_embedding_default_env(db: Session, user_id: int) -> UserPreference:
    from app.core.embedding_env import is_embedding_env_configured

    if not is_embedding_env_configured():
        raise ValueError("System embedding is not configured")

    prefs = get_or_create_preferences(db, user_id)
    prefs.default_embedding_source = DEFAULT_SOURCE_ENV
    prefs.default_embedding_config_id = None
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def set_llm_default_config(db: Session, user_id: int, config_id: int) -> UserPreference:
    config = (
        db.query(LlmConfig)
        .filter(LlmConfig.id == config_id, LlmConfig.user_id == user_id)
        .first()
    )
    if not config:
        raise ValueError("LLM configuration not found")
    if not config.is_active:
        raise ValueError("Cannot set a disabled configuration as default")

    prefs = get_or_create_preferences(db, user_id)
    prefs.default_llm_source = DEFAULT_SOURCE_CONFIG
    prefs.default_llm_config_id = config_id
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def set_embedding_default_config(
    db: Session, user_id: int, config_id: int
) -> UserPreference:
    config = (
        db.query(EmbeddingConfig)
        .filter(EmbeddingConfig.id == config_id, EmbeddingConfig.user_id == user_id)
        .first()
    )
    if not config:
        raise ValueError("Embedding configuration not found")
    if not config.is_active:
        raise ValueError("Cannot set a disabled configuration as default")

    prefs = get_or_create_preferences(db, user_id)
    prefs.default_embedding_source = DEFAULT_SOURCE_CONFIG
    prefs.default_embedding_config_id = config_id
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def _latest_active_llm_config(db: Session, user_id: int) -> Optional[LlmConfig]:
    return (
        db.query(LlmConfig)
        .filter(LlmConfig.user_id == user_id, LlmConfig.is_active.is_(True))
        .order_by(LlmConfig.updated_at.desc())
        .first()
    )


def _latest_active_embedding_config(
    db: Session, user_id: int
) -> Optional[EmbeddingConfig]:
    return (
        db.query(EmbeddingConfig)
        .filter(EmbeddingConfig.user_id == user_id, EmbeddingConfig.is_active.is_(True))
        .order_by(EmbeddingConfig.updated_at.desc())
        .first()
    )


def repoint_llm_default_after_config_unavailable(
    db: Session, user_id: int, config_id: int
) -> None:
    prefs = get_or_create_preferences(db, user_id)
    if (
        prefs.default_llm_source != DEFAULT_SOURCE_CONFIG
        or prefs.default_llm_config_id != config_id
    ):
        return

    from app.core.chat_env import is_chat_env_configured

    if is_chat_env_configured():
        set_llm_default_env(db, user_id)
        return

    replacement = _latest_active_llm_config(db, user_id)
    if replacement:
        set_llm_default_config(db, user_id, replacement.id)
        return

    prefs.default_llm_source = DEFAULT_SOURCE_ENV
    prefs.default_llm_config_id = None
    db.add(prefs)
    db.commit()


def repoint_embedding_default_after_config_unavailable(
    db: Session, user_id: int, config_id: int
) -> None:
    prefs = get_or_create_preferences(db, user_id)
    if (
        prefs.default_embedding_source != DEFAULT_SOURCE_CONFIG
        or prefs.default_embedding_config_id != config_id
    ):
        return

    from app.core.embedding_env import is_embedding_env_configured

    if is_embedding_env_configured():
        set_embedding_default_env(db, user_id)
        return

    replacement = _latest_active_embedding_config(db, user_id)
    if replacement:
        set_embedding_default_config(db, user_id, replacement.id)
        return

    prefs.default_embedding_source = DEFAULT_SOURCE_ENV
    prefs.default_embedding_config_id = None
    db.add(prefs)
    db.commit()


def get_preferred_llm_config(db: Session, user_id: int) -> Optional[LlmConfig]:
    prefs = get_or_create_preferences(db, user_id)
    if prefs.default_llm_source != DEFAULT_SOURCE_CONFIG or not prefs.default_llm_config_id:
        return None

    config = (
        db.query(LlmConfig)
        .filter(
            LlmConfig.id == prefs.default_llm_config_id,
            LlmConfig.user_id == user_id,
            LlmConfig.is_active.is_(True),
        )
        .first()
    )
    if config is None:
        repoint_llm_default_after_config_unavailable(
            db, user_id, prefs.default_llm_config_id
        )
        return get_preferred_llm_config(db, user_id)
    return config


def get_preferred_embedding_config(
    db: Session, user_id: int
) -> Optional[EmbeddingConfig]:
    prefs = get_or_create_preferences(db, user_id)
    if (
        prefs.default_embedding_source != DEFAULT_SOURCE_CONFIG
        or not prefs.default_embedding_config_id
    ):
        return None

    config = (
        db.query(EmbeddingConfig)
        .filter(
            EmbeddingConfig.id == prefs.default_embedding_config_id,
            EmbeddingConfig.user_id == user_id,
            EmbeddingConfig.is_active.is_(True),
        )
        .first()
    )
    if config is None:
        repoint_embedding_default_after_config_unavailable(
            db, user_id, prefs.default_embedding_config_id
        )
        return get_preferred_embedding_config(db, user_id)
    return config
