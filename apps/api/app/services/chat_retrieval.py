"""Merge retrieval results across multiple knowledge-base vector stores."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator, Dict, List, Sequence, Tuple

from langchain_core.documents import Document as LangchainDocument

logger = logging.getLogger(__name__)

DEFAULT_K_PER_KB = 4
MAX_MERGED_DOCS = 12


def _doc_dedupe_key(doc: LangchainDocument) -> Tuple[Any, ...]:
    meta = doc.metadata or {}
    content = (doc.page_content or "")[:240]
    return (
        meta.get("kb_id"),
        meta.get("document_id"),
        content,
    )


async def _search_one_kb(
    store: Any, kb_id: int, search_query: str, k: int
) -> List[LangchainDocument]:
    retriever = store.as_retriever(search_kwargs={"k": k})
    try:
        docs = await retriever.ainvoke(search_query)
    except Exception as exc:
        logger.warning(
            "Retrieval failed for kb_id=%s: %s", kb_id, exc, exc_info=True
        )
        return []
    out: List[LangchainDocument] = []
    for doc in docs or []:
        meta = dict(doc.metadata or {})
        meta.setdefault("kb_id", kb_id)
        out.append(
            LangchainDocument(page_content=doc.page_content, metadata=meta)
        )
    return out


def _yield_unique_docs(
    batch: List[LangchainDocument],
    seen: set[Tuple[Any, ...]],
    merged_count: int,
    max_docs: int,
    stats: Dict[str, int] | None = None,
) -> List[LangchainDocument]:
    """Return new unique docs from a batch without exceeding max_docs."""
    added: List[LangchainDocument] = []
    for doc in batch:
        if stats is not None:
            stats["raw_recalled"] = stats.get("raw_recalled", 0) + 1
        if merged_count + len(added) >= max_docs:
            continue
        key = _doc_dedupe_key(doc)
        if key in seen:
            continue
        seen.add(key)
        added.append(doc)
    return added


async def stream_retrieve_from_knowledge_bases(
    search_query: str,
    vector_stores: Sequence[Any],
    kb_ids: Sequence[int],
    *,
    k_per_kb: int = DEFAULT_K_PER_KB,
    max_docs: int = MAX_MERGED_DOCS,
    stats: Dict[str, int] | None = None,
) -> AsyncIterator[LangchainDocument]:
    """Yield merged documents as each KB search completes (multi-KB) or in order (single)."""
    if not vector_stores:
        return

    seen: set[Tuple[Any, ...]] = set()
    merged_count = 0

    if len(vector_stores) == 1:
        batch = await _search_one_kb(
            vector_stores[0], kb_ids[0], search_query, max_docs
        )
        for doc in _yield_unique_docs(
            batch, seen, merged_count, max_docs, stats
        ):
            merged_count += 1
            yield doc
            await asyncio.sleep(0)
        return

    pairs = list(zip(vector_stores, kb_ids))
    tasks = [
        asyncio.create_task(_search_one_kb(store, kb_id, search_query, k_per_kb))
        for store, kb_id in pairs
    ]
    try:
        for finished in asyncio.as_completed(tasks):
            batch = await finished
            for doc in _yield_unique_docs(
                batch, seen, merged_count, max_docs, stats
            ):
                merged_count += 1
                yield doc
                await asyncio.sleep(0)
                if merged_count >= max_docs:
                    return
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()


async def retrieve_from_knowledge_bases(
    search_query: str,
    vector_stores: Sequence[Any],
    kb_ids: Sequence[int],
    *,
    k_per_kb: int = DEFAULT_K_PER_KB,
    max_docs: int = MAX_MERGED_DOCS,
) -> List[LangchainDocument]:
    """Retrieve from each KB store in parallel and merge with deduplication."""
    return [
        doc
        async for doc in stream_retrieve_from_knowledge_bases(
            search_query,
            vector_stores,
            kb_ids,
            k_per_kb=k_per_kb,
            max_docs=max_docs,
        )
    ]
