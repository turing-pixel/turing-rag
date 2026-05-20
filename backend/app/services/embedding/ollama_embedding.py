"""Ollama embedding model helpers."""

from __future__ import annotations

import logging
from typing import Dict, Optional

from langchain_ollama import OllamaEmbeddings

logger = logging.getLogger(__name__)

# Supported Ollama embedding models (set OLLAMA_EMBEDDINGS_MODEL in .env).
OLLAMA_EMBEDDING_MODELS: Dict[str, Dict[str, object]] = {
    "bge-m3": {
        "dimensions": 1024,
        "description": "Multilingual retrieval; better Chinese/English quality (~1.2GB)",
        "pull": "ollama pull bge-m3",
    },
    "nomic-embed-text": {
        "dimensions": 768,
        "description": "Lightweight and fast; lower resource usage (~274MB)",
        "pull": "ollama pull nomic-embed-text",
    },
}


def normalize_ollama_embedding_model(model: str) -> str:
    """Strip Ollama tag suffix (e.g. bge-m3:latest -> bge-m3)."""
    return model.split(":", 1)[0].strip()


def validate_ollama_embedding_model(model: str) -> Optional[str]:
    """
    Return a warning message if the model is not in the known list.
    Unknown models are still allowed (custom Ollama models).
    """
    base = normalize_ollama_embedding_model(model)
    if base not in OLLAMA_EMBEDDING_MODELS:
        known = ", ".join(sorted(OLLAMA_EMBEDDING_MODELS))
        return (
            f"OLLAMA_EMBEDDINGS_MODEL '{model}' is not a documented model. "
            f"Recommended: {known}. Ensure you ran the matching `ollama pull`."
        )
    return None


def format_ollama_embedding_models_help() -> str:
    lines = ["Supported Ollama embedding models (OLLAMA_EMBEDDINGS_MODEL):"]
    for name, meta in OLLAMA_EMBEDDING_MODELS.items():
        lines.append(
            f"  - {name}: {meta['dimensions']} dims, {meta['description']} "
            f"({meta['pull']})"
        )
    return "\n".join(lines)


def create_ollama_embeddings(*, model: str, base_url: str) -> OllamaEmbeddings:
    normalized = normalize_ollama_embedding_model(model)
    warning = validate_ollama_embedding_model(model)
    if warning:
        logger.warning(warning)
    else:
        meta = OLLAMA_EMBEDDING_MODELS[normalized]
        logger.info(
            "Using Ollama embedding model %s (%s dims)",
            normalized,
            meta["dimensions"],
        )
    return OllamaEmbeddings(model=normalized, base_url=base_url)
