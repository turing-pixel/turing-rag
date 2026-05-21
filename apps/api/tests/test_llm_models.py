"""Unit tests for chat LLM model catalog."""
import os
from unittest.mock import patch

from app.services.llm.llm_models import (
    get_available_llm_providers,
    get_default_llm_config,
    validate_llm_config,
)


class TestLlmModels:
    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "DEEPSEEK_API_KEY": "test-key",
            "DEEPSEEK_MODEL": "deepseek-chat",
            "OPENAI_API_KEY": "",
            "MINIMAX_API_KEY": "",
        },
        clear=False,
    )
    def test_lists_configured_provider(self):
        from app.core.config import Settings

        with patch("app.services.llm.llm_models.settings", Settings()):
            providers = get_available_llm_providers()
            assert len(providers) == 1
            assert providers[0].provider == "deepseek"
            assert any(model.model == "deepseek-chat" for model in providers[0].models)

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "DEEPSEEK_API_KEY": "test-key",
            "DEEPSEEK_MODEL": "deepseek-chat",
        },
        clear=False,
    )
    def test_validate_llm_config(self):
        from app.core.config import Settings

        with patch("app.services.llm.llm_models.settings", Settings()):
            provider, model = validate_llm_config("deepseek", "deepseek-chat")
            assert provider == "deepseek"
            assert model == "deepseek-chat"

    @patch.dict(
        os.environ,
        {
            "CHAT_PROVIDER": "deepseek",
            "DEEPSEEK_API_KEY": "test-key",
            "DEEPSEEK_MODEL": "deepseek-chat",
        },
        clear=False,
    )
    def test_default_llm_config(self):
        from app.core.config import Settings

        with patch("app.services.llm.llm_models.settings", Settings()):
            provider, model = get_default_llm_config()
            assert provider == "deepseek"
            assert model == "deepseek-chat"
