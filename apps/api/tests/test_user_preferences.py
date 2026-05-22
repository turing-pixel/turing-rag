"""Tests for user_preferences default resolution."""

import os
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import EmbeddingConfig, LlmConfig, User, UserPreference
from app.models.base import Base
from app.models.user_preference import DEFAULT_SOURCE_ENV
from app.services.embedding.embedding_config_service import (
    create_user_embeddings,
    resolve_embedding_runtime,
    update_embedding_config,
)
from app.services.llm.llm_config_service import update_llm_config
from app.services.user_preference_service import (
    get_or_create_preferences,
    is_llm_config_default,
    set_llm_default_config,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    user = User(
        email="u@example.com",
        username="user1",
        hashed_password="hash",
    )
    session.add(user)
    session.commit()
    yield session, user
    session.close()


class TestUserPreferences:
    def test_preferences_created_with_env_default(self, db_session):
        session, user = db_session
        prefs = get_or_create_preferences(session, user.id)
        assert prefs.default_llm_source == DEFAULT_SOURCE_ENV
        assert prefs.default_llm_config_id is None

    def test_set_llm_default_config(self, db_session):
        session, user = db_session
        config = LlmConfig(
            user_id=user.id,
            name="My GPT",
            provider="openai",
            model="gpt-4o",
            api_key="sk-test",
            is_active=True,
            is_default=False,
        )
        session.add(config)
        session.commit()

        set_llm_default_config(session, user.id, config.id)
        assert is_llm_config_default(session, user.id, config.id)

    def test_deactivate_default_repoints_to_env(self, db_session):
        session, user = db_session
        from app.schemas.llm_config import LlmConfigUpdate

        config = LlmConfig(
            user_id=user.id,
            name="My GPT",
            provider="openai",
            model="gpt-4o",
            api_key="sk-test",
            is_active=True,
            is_default=False,
        )
        session.add(config)
        session.commit()
        set_llm_default_config(session, user.id, config.id)

        env = {
            "CHAT_PROVIDER": "deepseek",
            "CHAT_API_KEY": "test-key",
            "CHAT_API_BASE": "https://api.deepseek.com",
            "CHAT_MODEL": "deepseek-chat",
        }
        from app.core.config import Settings

        with patch.dict(os.environ, env, clear=False):
            with patch("app.core.chat_env.settings", Settings()):
                update_llm_config(
                    session,
                    config,
                    LlmConfigUpdate(is_active=False),
                    skip_verify=True,
                )
                prefs = get_or_create_preferences(session, user.id)
                assert prefs.default_llm_source == DEFAULT_SOURCE_ENV
                assert not is_llm_config_default(session, user.id, config.id)

    def test_resolve_embedding_raises_when_unconfigured(self, db_session):
        session, user = db_session
        with patch(
            "app.core.embedding_env.is_embedding_env_configured",
            return_value=False,
        ):
            with pytest.raises(ValueError, match="No embedding model configured"):
                resolve_embedding_runtime(session, user.id)

    @patch.dict(
        os.environ,
        {
            "EMBEDDINGS_PROVIDER": "ollama",
            "EMBEDDINGS_API_BASE": "http://localhost:11434",
            "EMBEDDINGS_MODEL": "bge-m3",
        },
        clear=False,
    )
    @patch("app.services.embedding.embedding_factory.create_ollama_embeddings")
    def test_embedding_env_default_via_preferences(self, mock_create, db_session):
        from app.core.config import Settings

        session, user = db_session
        with patch("app.core.embedding_env.settings", Settings()):
            get_or_create_preferences(session, user.id)
            create_user_embeddings(session, user.id)
        mock_create.assert_called_once()
