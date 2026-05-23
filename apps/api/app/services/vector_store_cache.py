"""Process-local cache for knowledge-base vector store instances."""

from __future__ import annotations

from threading import Lock
from typing import Any, Tuple

from app.core.config import settings
from app.services.vector_store import VectorStoreFactory

_cache: dict[Tuple[str, int, int, str], Any] = {}
_lock = Lock()


def get_kb_vector_store(
    *,
    user_id: int,
    kb_id: int,
    embedding_function: Any,
    embedding_cache_key: str = "",
) -> Any:
    """Return a cached vector store for a KB collection (per user + store type)."""
    key = (settings.VECTOR_STORE_TYPE, user_id, kb_id, embedding_cache_key)
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


def invalidate_kb_vector_store(
    *, user_id: int, kb_id: int, embedding_cache_key: str | None = None
) -> None:
    """Drop cached store after KB documents change (optional hook)."""
    with _lock:
        if embedding_cache_key is not None:
            key = (settings.VECTOR_STORE_TYPE, user_id, kb_id, embedding_cache_key)
            _cache.pop(key, None)
            return
        for key in list(_cache):
            store_type, cached_user_id, cached_kb_id, _cached_embedding = key
            if (
                store_type == settings.VECTOR_STORE_TYPE
                and cached_user_id == user_id
                and cached_kb_id == kb_id
            ):
                _cache.pop(key, None)
