from app.core.config import settings
from app.services.embedding.ollama_embedding import (
    create_ollama_embeddings,
    format_ollama_embedding_models_help,
)
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings


class EmbeddingsFactory:
    @staticmethod
    def create():
        """
        Factory method to create an embeddings instance based on .env config.

        Ollama embeddings: set EMBEDDINGS_PROVIDER=ollama and OLLAMA_EMBEDDINGS_MODEL
        to bge-m3 or nomic-embed-text (see ollama_embedding.OLLAMA_EMBEDDING_MODELS).
        """
        embeddings_provider = settings.EMBEDDINGS_PROVIDER.lower()

        if embeddings_provider == "openai":
            return OpenAIEmbeddings(
                openai_api_key=settings.OPENAI_API_KEY,
                openai_api_base=settings.OPENAI_API_BASE,
                model=settings.OPENAI_EMBEDDINGS_MODEL
            )
        elif embeddings_provider == "dashscope":
            return DashScopeEmbeddings(
                model=settings.DASH_SCOPE_EMBEDDINGS_MODEL,
                dashscope_api_key=settings.DASH_SCOPE_API_KEY
            )
        elif embeddings_provider == "ollama":
            if not settings.OLLAMA_EMBEDDINGS_MODEL:
                raise ValueError(
                    "OLLAMA_EMBEDDINGS_MODEL is required when EMBEDDINGS_PROVIDER=ollama.\n"
                    + format_ollama_embedding_models_help()
                )
            return create_ollama_embeddings(
                model=settings.OLLAMA_EMBEDDINGS_MODEL,
                base_url=settings.OLLAMA_API_BASE,
            )
        elif embeddings_provider == "huggingface":
            model_kwargs = {}
            if settings.HUGGINGFACE_API_KEY:
                model_kwargs["token"] = settings.HUGGINGFACE_API_KEY
            return HuggingFaceEmbeddings(
                model_name=settings.HUGGINGFACE_EMBEDDINGS_MODEL,
                model_kwargs=model_kwargs
            )
        else:
            raise ValueError(f"Unsupported embeddings provider: {embeddings_provider}")
