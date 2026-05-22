"""Create Chroma HTTP client (local `pnpm dev` / prod `docker-compose.chroma.yml`)."""

from __future__ import annotations

import logging
import threading
import time
from typing import Dict, Optional

import chromadb
from chromadb import ClientAPI

from app.core.config import settings

logger = logging.getLogger(__name__)

_chroma_lock = threading.Lock()
_chroma_clients: Dict[str, ClientAPI] = {}

CHROMA_CONNECT_RETRIES = 5
CHROMA_CONNECT_BASE_DELAY_S = 0.3


def _is_transient_chroma_error(exc: BaseException) -> bool:
    """502/503 from local Chroma HTTP often means the server is still starting or overloaded."""
    import httpx

    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (502, 503, 504)
    msg = str(exc).lower()
    return any(
        token in msg
        for token in ("502", "503", "504", "bad gateway", "connection refused")
    )


def _verify_http_client(client: ClientAPI) -> None:
    """Same check HttpClient runs on init; fail fast with a clear error before processing."""
    client.get_user_identity()


def _create_http_client(host: str, port: int) -> ClientAPI:
    last_error: Optional[BaseException] = None
    for attempt in range(1, CHROMA_CONNECT_RETRIES + 1):
        try:
            client = chromadb.HttpClient(host=host, port=port)
            _verify_http_client(client)
            return client
        except Exception as exc:
            last_error = exc
            if attempt >= CHROMA_CONNECT_RETRIES or not _is_transient_chroma_error(exc):
                break
            delay = CHROMA_CONNECT_BASE_DELAY_S * (2 ** (attempt - 1))
            logger.warning(
                "Chroma HTTP connect attempt %s/%s failed (%s:%s), retry in %.1fs",
                attempt,
                CHROMA_CONNECT_RETRIES,
                host,
                port,
                delay,
            )
            time.sleep(delay)
    assert last_error is not None
    raise last_error


def create_chroma_client() -> ClientAPI:
    """Connect to the Chroma HTTP server (never embedded PersistentClient)."""
    cache_key = settings.CHROMA_URL.strip()
    with _chroma_lock:
        cached = _chroma_clients.get(cache_key)
        if cached is not None:
            return cached
        logger.info("Chroma HTTP: %s", settings.CHROMA_URL)
        try:
            client = _create_http_client(
                settings.chroma_host,
                settings.chroma_port,
            )
        except Exception as exc:
            logger.error(
                "Chroma HTTP unavailable at %s (chromadb %s). "
                "Run `pnpm dev:chroma` or align chromadb/chroma CLI versions.",
                settings.CHROMA_URL,
                getattr(chromadb, "__version__", "unknown"),
                exc_info=exc,
            )
            raise
        _chroma_clients[cache_key] = client
        return client


def warmup_chroma_client() -> None:
    """Eager-connect at API startup so the first document task does not race Chroma boot."""
    if settings.VECTOR_STORE_TYPE.lower().strip() != "chroma":
        return
    create_chroma_client()
    logger.info("Chroma client ready")
