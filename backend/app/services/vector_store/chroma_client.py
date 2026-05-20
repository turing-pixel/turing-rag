"""Create Chroma client for HTTP (Docker) or local persistent (dev) mode."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import chromadb
from chromadb import ClientAPI

from app.core.config import settings

logger = logging.getLogger(__name__)


def default_persist_directory() -> str:
    """Repository chroma_data directory (…/rag-web-ui/chroma_data)."""
    repo_root = Path(__file__).resolve().parents[4]
    return str(repo_root / "chroma_data")


def create_chroma_client() -> ClientAPI:
    """
    persistent: local SQLite/HNSW under CHROMA_PERSIST_DIRECTORY (no chroma server)
    http: connect to Chroma HTTP server (Docker / chroma run)
    """
    mode = settings.CHROMA_MODE.lower().strip()

    if mode == "persistent":
        persist_dir = settings.CHROMA_PERSIST_DIRECTORY or default_persist_directory()
        persist_dir = os.path.abspath(persist_dir)
        os.makedirs(persist_dir, exist_ok=True)
        logger.info("Chroma persistent mode: %s", persist_dir)
        return chromadb.PersistentClient(path=persist_dir)

    if mode == "http":
        logger.info(
            "Chroma HTTP mode: %s:%s",
            settings.CHROMA_DB_HOST,
            settings.CHROMA_DB_PORT,
        )
        return chromadb.HttpClient(
            host=settings.CHROMA_DB_HOST,
            port=settings.CHROMA_DB_PORT,
        )

    raise ValueError(
        f"Unsupported CHROMA_MODE: {settings.CHROMA_MODE!r}. Use 'persistent' or 'http'."
    )
