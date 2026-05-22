"""Unit tests for chat LLM model catalog."""
import os
from unittest.mock import MagicMock, patch

from app.services.llm.llm_models import (
    LlmModelOption,
    LlmProviderOption,
    _merge_providers,
    get_available_llm_providers,
    get_default_llm_config,
    validate_llm_config,
)


class TestLlmModels:
    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "CHAT_API_KEY": "test-key",
            "CHAT_API_BASE": "https://api.deepseek.com",
            "CHAT_MODEL": "deepseek-chat",
            "OPENAI_API_KEY": "",
            "MINIMAX_API_KEY": "",
        },
        clear=False,
    )
    def test_lists_configured_provider(self):
        from app.core.config import Settings

        with patch("app.core.chat_env.settings", Settings()):
            providers = get_available_llm_providers()
            assert len(providers) == 1
            assert providers[0].provider == "deepseek"
            assert len(providers[0].models) == 1
            assert providers[0].models[0].model == "deepseek-chat"
            assert providers[0].models[0].config_id is None

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "CHAT_API_KEY": "test-key",
            "CHAT_MODEL": "deepseek-chat",
        },
        clear=False,
    )
    def test_validate_llm_config(self):
        from app.core.config import Settings

        with patch("app.core.chat_env.settings", Settings()):
            provider, model = validate_llm_config("deepseek", "deepseek-chat")
            assert provider == "deepseek"
            assert model == "deepseek-chat"

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "CHAT_API_KEY": "test-key",
            "CHAT_MODEL": "deepseek-chat",
        },
        clear=False,
    )
    def test_default_llm_config(self):
        from app.core.config import Settings

        with patch("app.core.chat_env.settings", Settings()):
            provider, model = get_default_llm_config()
            assert provider == "deepseek"
            assert model == "deepseek-chat"

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "CHAT_API_KEY": "test-key",
            "CHAT_MODEL": "deepseek-v4-flash",
            "OLLAMA_API_BASE": "http://localhost:11434",
        },
        clear=False,
    )
    def test_ollama_hidden_when_only_used_for_embeddings(self):
        from app.core.config import Settings

        with patch("app.core.chat_env.settings", Settings()):
            providers = get_available_llm_providers()
            assert len(providers) == 1
            assert providers[0].provider == "deepseek"
            assert all(item.provider != "ollama" for item in providers)

    def test_merge_providers_combines_db_and_env(self):
        db_providers = [
            LlmProviderOption(
                provider="openai",
                label="OpenAI",
                models=[
                    LlmModelOption(
                        provider="openai",
                        model="gpt-4o",
                        label="My GPT-4o",
                        is_default=True,
                        config_id=1,
                    )
                ],
            )
        ]
        env_providers = [
            LlmProviderOption(
                provider="openai",
                label="OpenAI",
                models=[
                    LlmModelOption(
                        provider="openai",
                        model="gpt-4o",
                        label="GPT-4o",
                        is_default=True,
                    ),
                    LlmModelOption(
                        provider="openai",
                        model="gpt-4o-mini",
                        label="GPT-4o mini",
                    ),
                ],
            ),
            LlmProviderOption(
                provider="deepseek",
                label="DeepSeek",
                models=[
                    LlmModelOption(
                        provider="deepseek",
                        model="deepseek-chat",
                        label="deepseek-chat",
                        is_default=False,
                    )
                ],
            ),
        ]

        merged = _merge_providers(db_providers, env_providers)
        openai = next(item for item in merged if item.provider == "openai")
        assert len(openai.models) == 2
        assert openai.models[0].config_id == 1
        assert openai.models[0].label == "My GPT-4o"
        assert any(model.model == "gpt-4o-mini" for model in openai.models)
        assert not any(
            model.model == "gpt-4o" and model.config_id is None
            for model in openai.models
        )

        deepseek = next(item for item in merged if item.provider == "deepseek")
        assert len(deepseek.models) == 1
        assert deepseek.models[0].is_default is False

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "DEEPSEEK_API_KEY": "legacy-key",
            "DEEPSEEK_MODEL": "deepseek-legacy",
            "CHAT_API_KEY": "",
            "CHAT_MODEL": "",
        },
        clear=False,
    )
    def test_legacy_provider_env_fallback(self):
        from app.core.config import Settings

        with patch("app.core.chat_env.settings", Settings()):
            providers = get_available_llm_providers()
            assert len(providers) == 1
            assert providers[0].models[0].model == "deepseek-legacy"

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "CHAT_API_KEY": "env-key",
            "CHAT_API_BASE": "https://api.deepseek.com",
            "CHAT_MODEL": "deepseek-chat",
        },
        clear=False,
    )
    def test_resolve_runtime_prefers_env_when_no_config_id(self):
        from app.core.config import Settings
        from app.services.llm.llm_config_service import resolve_runtime_config

        duplicate_db = MagicMock()
        duplicate_db.id = 42
        duplicate_db.provider = "deepseek"
        duplicate_db.model = "deepseek-chat"
        duplicate_db.is_active = True
        duplicate_db.api_key = "db-key"
        duplicate_db.api_base = "https://db.example"
        duplicate_db.name = "DB DeepSeek"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = (
            duplicate_db
        )

        with patch("app.core.chat_env.settings", Settings()):
            runtime = resolve_runtime_config(
                mock_db,
                user_id=1,
                llm_config_id=None,
                llm_provider="deepseek",
                llm_model="deepseek-chat",
            )

        assert runtime.config_id is None
        assert runtime.api_key == "env-key"
