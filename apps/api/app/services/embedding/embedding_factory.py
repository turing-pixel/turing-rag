from typing import Optional

from app.core.embedding_env import (
    embeddings_provider_id,
    resolve_embedding_credentials,
)
from app.services.embedding.embedding_config_service import ResolvedEmbeddingRuntime
from app.services.embedding.ollama_embedding import (
    create_ollama_embeddings,
    format_ollama_embedding_models_help,
)
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings


class EmbeddingsFactory:
    @staticmethod
    def create(runtime: Optional[ResolvedEmbeddingRuntime] = None):
        """
        Create an embeddings instance from a user DB config or .env defaults.
        """
        if runtime is not None:
            embeddings_provider = runtime.provider.lower()
            creds = resolve_embedding_credentials(embeddings_provider)
            model = runtime.model or creds.model
            api_key = runtime.api_key or creds.api_key
            api_base = runtime.api_base or creds.api_base
        else:
            embeddings_provider = embeddings_provider_id()
            creds = resolve_embedding_credentials(embeddings_provider)
            model = creds.model
            api_key = creds.api_key
            api_base = creds.api_base

        if embeddings_provider == "openai":
            return OpenAIEmbeddings(
                openai_api_key=api_key,
                openai_api_base=api_base,
                model=model,
            )
        if embeddings_provider == "dashscope":
            return DashScopeEmbeddings(
                model=model,
                dashscope_api_key=api_key,
            )
        if embeddings_provider == "ollama":
            if not model:
                raise ValueError(
                    "EMBEDDINGS_MODEL is required when EMBEDDINGS_PROVIDER=ollama.\n"
                    + format_ollama_embedding_models_help()
                )
            return create_ollama_embeddings(
                model=model,
                base_url=api_base,
            )
        if embeddings_provider == "huggingface":
            model_kwargs = {}
            if api_key:
                model_kwargs["token"] = api_key
            return HuggingFaceEmbeddings(
                model_name=model,
                model_kwargs=model_kwargs,
            )
        raise ValueError(f"Unsupported embeddings provider: {embeddings_provider}")
