from typing import Optional

from langchain_core.language_models import BaseChatModel
from langchain_deepseek import ChatDeepSeek
from langchain_ollama import OllamaLLM
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.services.llm.provider_registry import (
    OPENAI_COMPATIBLE_PROVIDERS,
    get_provider_definition,
)


class LLMFactory:
    @staticmethod
    def create(
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        temperature: float = 0,
        streaming: bool = True,
    ) -> BaseChatModel:
        """
        Create a LLM instance based on the provider
        """
        provider = (provider or settings.CHAT_PROVIDER).lower()
        definition = get_provider_definition(provider)
        factory_kind = definition.factory if definition else None

        if provider == "openai" or factory_kind == "openai":
            return ChatOpenAI(
                temperature=temperature,
                streaming=streaming,
                model=model or settings.OPENAI_MODEL,
                openai_api_key=api_key or settings.OPENAI_API_KEY,
                openai_api_base=api_base or settings.OPENAI_API_BASE,
            )
        if provider == "deepseek" or factory_kind == "deepseek":
            return ChatDeepSeek(
                temperature=temperature,
                streaming=streaming,
                model=model or settings.DEEPSEEK_MODEL,
                api_key=api_key or settings.DEEPSEEK_API_KEY,
                api_base=api_base or settings.DEEPSEEK_API_BASE,
            )
        if provider == "ollama" or factory_kind == "ollama":
            return OllamaLLM(
                model=model or settings.OLLAMA_MODEL,
                base_url=api_base or settings.OLLAMA_API_BASE,
                temperature=temperature,
                streaming=streaming,
            )
        if provider == "minimax" or factory_kind == "minimax":
            clamped_temperature = max(0.01, min(temperature, 1.0))
            return ChatOpenAI(
                temperature=clamped_temperature,
                streaming=streaming,
                model=model or settings.MINIMAX_MODEL,
                openai_api_key=api_key or settings.MINIMAX_API_KEY,
                openai_api_base=api_base or settings.MINIMAX_API_BASE,
            )
        if provider in OPENAI_COMPATIBLE_PROVIDERS or factory_kind == "openai_compatible":
            if not (api_key or "").strip():
                raise ValueError(f"API key is required for provider: {provider}")
            if not (api_base or "").strip():
                raise ValueError(f"API base URL is required for provider: {provider}")
            return ChatOpenAI(
                temperature=temperature,
                streaming=streaming,
                model=model or (definition.default_model if definition else "gpt-4o"),
                openai_api_key=api_key,
                openai_api_base=api_base,
            )

        raise ValueError(f"Unsupported LLM provider: {provider}")
