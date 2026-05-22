from dataclasses import dataclass

SUPPORTED_EMBEDDING_PROVIDERS: tuple[str, ...] = (
    "openai",
    "ollama",
    "dashscope",
    "huggingface",
)


@dataclass(frozen=True)
class EmbeddingProviderDefinition:
    id: str
    label: str
    default_api_base: str
    default_model: str
    requires_api_key: bool
    catalog_models: tuple[tuple[str, str], ...] = ()


EMBEDDING_PROVIDER_REGISTRY: tuple[EmbeddingProviderDefinition, ...] = (
    EmbeddingProviderDefinition(
        id="ollama",
        label="Ollama",
        default_api_base="http://localhost:11434",
        default_model="bge-m3",
        requires_api_key=False,
        catalog_models=(
            ("bge-m3", "bge-m3 (1024 dims, multilingual)"),
            ("nomic-embed-text", "nomic-embed-text (768 dims, lightweight)"),
        ),
    ),
    EmbeddingProviderDefinition(
        id="openai",
        label="OpenAI",
        default_api_base="https://api.openai.com/v1",
        default_model="text-embedding-ada-002",
        requires_api_key=True,
        catalog_models=(
            ("text-embedding-3-large", "text-embedding-3-large"),
            ("text-embedding-3-small", "text-embedding-3-small"),
            ("text-embedding-ada-002", "text-embedding-ada-002"),
        ),
    ),
    EmbeddingProviderDefinition(
        id="dashscope",
        label="DashScope",
        default_api_base="",
        default_model="text-embedding-v3",
        requires_api_key=True,
        catalog_models=(
            ("text-embedding-v3", "text-embedding-v3"),
            ("text-embedding-v2", "text-embedding-v2"),
        ),
    ),
    EmbeddingProviderDefinition(
        id="huggingface",
        label="HuggingFace",
        default_api_base="",
        default_model="sentence-transformers/all-MiniLM-L6-v2",
        requires_api_key=False,
        catalog_models=(
            (
                "sentence-transformers/all-MiniLM-L6-v2",
                "all-MiniLM-L6-v2 (lightweight)",
            ),
            (
                "sentence-transformers/all-mpnet-base-v2",
                "all-mpnet-base-v2 (better quality)",
            ),
            ("BAAI/bge-small-en-v1.5", "bge-small-en-v1.5"),
            ("BAAI/bge-large-en-v1.5", "bge-large-en-v1.5"),
        ),
    ),
)

_PROVIDER_BY_ID: dict[str, EmbeddingProviderDefinition] = {
    p.id: p for p in EMBEDDING_PROVIDER_REGISTRY
}


def get_embedding_provider_definition(
    provider: str,
) -> EmbeddingProviderDefinition | None:
    return _PROVIDER_BY_ID.get(provider.lower())


def list_embedding_provider_definitions() -> list[EmbeddingProviderDefinition]:
    return list(EMBEDDING_PROVIDER_REGISTRY)
