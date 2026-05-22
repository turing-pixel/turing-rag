from typing import Optional

from langchain_core.language_models import BaseChatModel
from langchain_deepseek import ChatDeepSeek
from langchain_ollama import OllamaLLM
from langchain_openai import ChatOpenAI

from app.core.chat_env import chat_provider_id, resolve_chat_credentials
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
        provider = (provider or chat_provider_id()).lower()
        creds = resolve_chat_credentials(provider)
        definition = get_provider_definition(provider)
        factory_kind = definition.factory if definition else None
        resolved_model = model or creds.model
        resolved_api_key = api_key or creds.api_key
        resolved_api_base = api_base or creds.api_base

        if provider == "openai" or factory_kind == "openai":
            return ChatOpenAI(
                temperature=temperature,
                streaming=streaming,
                model=resolved_model,
                openai_api_key=resolved_api_key,
                openai_api_base=resolved_api_base,
            )
        if provider == "deepseek" or factory_kind == "deepseek":
            return ChatDeepSeek(
                temperature=temperature,
                streaming=streaming,
                model=resolved_model,
                api_key=resolved_api_key,
                api_base=resolved_api_base,
            )
        if provider == "ollama" or factory_kind == "ollama":
            return OllamaLLM(
                model=resolved_model,
                base_url=resolved_api_base,
                temperature=temperature,
                streaming=streaming,
            )
        if provider == "minimax" or factory_kind == "minimax":
            clamped_temperature = max(0.01, min(temperature, 1.0))
            return ChatOpenAI(
                temperature=clamped_temperature,
                streaming=streaming,
                model=resolved_model,
                openai_api_key=resolved_api_key,
                openai_api_base=resolved_api_base,
            )
        if provider in OPENAI_COMPATIBLE_PROVIDERS or factory_kind == "openai_compatible":
            if not (resolved_api_key or "").strip():
                raise ValueError(f"API key is required for provider: {provider}")
            if not (resolved_api_base or "").strip():
                raise ValueError(f"API base URL is required for provider: {provider}")
            return ChatOpenAI(
                temperature=temperature,
                streaming=streaming,
                model=resolved_model or (definition.default_model if definition else "gpt-4o"),
                openai_api_key=resolved_api_key,
                openai_api_base=resolved_api_base,
            )

        raise ValueError(f"Unsupported LLM provider: {provider}")
