"""Process-local cache for knowledge-base vector store instances."""

from __future__ import annotations

from threading import Lock
from typing import Any, Tuple

from app.core.config import settings
from app.services.vector_store import VectorStoreFactory

_cache: dict[Tuple[str, int, int], Any] = {}
_lock = Lock()


def get_kb_vector_store(
    *,
    user_id: int,
    kb_id: int,
    embedding_function: Any,
) -> Any:
    """Return a cached vector store for a KB collection (per user + store type)."""
    key = (settings.VECTOR_STORE_TYPE, user_id, kb_id)
    with _lock:
        cached = _cache.get(key)
        if cached is not None:
            return cached
        store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb_id}",
            embedding_function=embedding_function,
        )
        _cache[key] = store
        return store


def invalidate_kb_vector_store(*, user_id: int, kb_id: int) -> None:
    """Drop cached store after KB documents change (optional hook)."""
    key = (settings.VECTOR_STORE_TYPE, user_id, kb_id)
    with _lock:
        _cache.pop(key, None)
