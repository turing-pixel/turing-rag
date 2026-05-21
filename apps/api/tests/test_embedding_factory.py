"""Tests for embedding factory and Ollama embedding models."""

import os
from unittest.mock import patch

import pytest

from app.services.embedding.ollama_embedding import (
    OLLAMA_EMBEDDING_MODELS,
    create_ollama_embeddings,
    normalize_ollama_embedding_model,
    validate_ollama_embedding_model,
)
from app.services.embedding.embedding_factory import EmbeddingsFactory


class TestOllamaEmbeddingModels:
    def test_supported_models_documented(self):
        assert "bge-m3" in OLLAMA_EMBEDDING_MODELS
        assert "nomic-embed-text" in OLLAMA_EMBEDDING_MODELS
        assert OLLAMA_EMBEDDING_MODELS["bge-m3"]["dimensions"] == 1024
        assert OLLAMA_EMBEDDING_MODELS["nomic-embed-text"]["dimensions"] == 768

    def test_normalize_strips_tag(self):
        assert normalize_ollama_embedding_model("bge-m3:latest") == "bge-m3"
        assert normalize_ollama_embedding_model("nomic-embed-text") == "nomic-embed-text"

    def test_validate_known_models_no_warning(self):
        assert validate_ollama_embedding_model("bge-m3") is None
        assert validate_ollama_embedding_model("nomic-embed-text:latest") is None

    def test_validate_unknown_model_warns(self):
        msg = validate_ollama_embedding_model("unknown-model")
        assert msg is not None
        assert "bge-m3" in msg
        assert "nomic-embed-text" in msg

    @patch("app.services.embedding.ollama_embedding.OllamaEmbeddings")
    def test_create_ollama_embeddings_bge_m3(self, mock_cls):
        create_ollama_embeddings(model="bge-m3:latest", base_url="http://localhost:11434")
        mock_cls.assert_called_once_with(model="bge-m3", base_url="http://localhost:11434")

    @patch("app.services.embedding.ollama_embedding.OllamaEmbeddings")
    def test_create_ollama_embeddings_nomic(self, mock_cls):
        create_ollama_embeddings(
            model="nomic-embed-text", base_url="http://localhost:11434"
        )
        mock_cls.assert_called_once_with(
            model="nomic-embed-text", base_url="http://localhost:11434"
        )


class TestEmbeddingsFactoryOllama:
    @patch("app.services.embedding.embedding_factory.create_ollama_embeddings")
    def test_factory_uses_bge_m3(self, mock_create):
        env = {
            "EMBEDDINGS_PROVIDER": "ollama",
            "OLLAMA_EMBEDDINGS_MODEL": "bge-m3",
            "OLLAMA_API_BASE": "http://localhost:11434",
        }
        with patch.dict(os.environ, env, clear=False):
            EmbeddingsFactory.create()
        mock_create.assert_called_once_with(
            model="bge-m3", base_url="http://localhost:11434"
        )

    @patch("app.services.embedding.embedding_factory.create_ollama_embeddings")
    def test_factory_uses_nomic_embed_text(self, mock_create):
        env = {
            "EMBEDDINGS_PROVIDER": "ollama",
            "OLLAMA_EMBEDDINGS_MODEL": "nomic-embed-text",
            "OLLAMA_API_BASE": "http://localhost:11434",
        }
        with patch.dict(os.environ, env, clear=False):
            EmbeddingsFactory.create()
        mock_create.assert_called_once_with(
            model="nomic-embed-text", base_url="http://localhost:11434"
        )

    def test_factory_ollama_requires_model(self):
        with patch("app.services.embedding.embedding_factory.settings") as mock_settings:
            mock_settings.EMBEDDINGS_PROVIDER = "ollama"
            mock_settings.OLLAMA_EMBEDDINGS_MODEL = ""
            mock_settings.OLLAMA_API_BASE = "http://localhost:11434"
            with pytest.raises(ValueError, match="OLLAMA_EMBEDDINGS_MODEL"):
                EmbeddingsFactory.create()
