from typing import Any

from sqlalchemy.orm import Session

from app.core.chat_env import is_chat_env_configured, resolve_chat_credentials
from app.core.embedding_env import is_embedding_env_configured, resolve_embedding_credentials
from app.models.user import User
from app.models.user_preference import DEFAULT_SOURCE_CONFIG, DEFAULT_SOURCE_ENV
from app.services.user_preference_service import get_or_create_preferences


def _llm_default_preference(db: Session, user_id: int) -> dict[str, Any]:
    prefs = get_or_create_preferences(db, user_id)
    if prefs.default_llm_source == DEFAULT_SOURCE_CONFIG and prefs.default_llm_config_id:
        config = prefs.default_llm_config
        if config is not None:
            return {
                "source": DEFAULT_SOURCE_CONFIG,
                "config_id": config.id,
                "config_name": config.name,
                "provider": config.provider,
                "model": config.model,
                "configured": True,
            }

    if not is_chat_env_configured():
        return {
            "source": DEFAULT_SOURCE_ENV,
            "configured": False,
        }

    creds = resolve_chat_credentials()
    return {
        "source": DEFAULT_SOURCE_ENV,
        "provider": creds.provider,
        "model": creds.model,
        "configured": True,
    }


def _embedding_default_preference(db: Session, user_id: int) -> dict[str, Any]:
    prefs = get_or_create_preferences(db, user_id)
    if (
        prefs.default_embedding_source == DEFAULT_SOURCE_CONFIG
        and prefs.default_embedding_config_id
    ):
        config = prefs.default_embedding_config
        if config is not None:
            return {
                "source": DEFAULT_SOURCE_CONFIG,
                "config_id": config.id,
                "config_name": config.name,
                "provider": config.provider,
                "model": config.model,
                "configured": True,
            }

    if not is_embedding_env_configured():
        return {
            "source": DEFAULT_SOURCE_ENV,
            "configured": False,
        }

    creds = resolve_embedding_credentials()
    return {
        "source": DEFAULT_SOURCE_ENV,
        "provider": creds.provider,
        "model": creds.model,
        "configured": True,
    }


def get_user_preferences_summary(db: Session, user_id: int) -> dict[str, Any]:
    return {
        "default_llm": _llm_default_preference(db, user_id),
        "default_embedding": _embedding_default_preference(db, user_id),
    }


def update_user_profile(
    db: Session,
    user: User,
    *,
    email: str | None = None,
    username: str | None = None,
    password: str | None = None,
) -> User:
    if email is not None and email != user.email:
        existing = db.query(User).filter(User.email == email, User.id != user.id).first()
        if existing:
            raise ValueError("A user with this email already exists.")
        user.email = email

    if username is not None and username != user.username:
        existing = (
            db.query(User).filter(User.username == username, User.id != user.id).first()
        )
        if existing:
            raise ValueError("A user with this username already exists.")
        user.username = username

    if password is not None:
        from app.core import security

        user.hashed_password = security.get_password_hash(password)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
