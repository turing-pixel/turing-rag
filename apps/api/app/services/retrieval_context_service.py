"""Shared retrieval for chat and workflows."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Sequence

from langchain_core.documents import Document as LangchainDocument
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge import Document, KnowledgeBase
from app.services.chat_retrieval import (
    RETRIEVAL_SCORE_METADATA_KEY,
    retrieve_from_knowledge_bases,
)
from app.services.embedding.embedding_config_service import (
    create_user_embeddings_with_runtime,
    embedding_runtime_cache_key,
)
from app.services.kb_resolve import get_kb_for_user
from app.services.vector_store_cache import get_kb_vector_store


@dataclass
class RetrievalDocument:
    content: str
    metadata: dict[str, Any]
    score: float | None
    citation_id: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "content": self.content,
            "metadata": self.metadata,
            "score": self.score,
            "citation_id": self.citation_id,
        }


@dataclass
class RetrievalResult:
    query: str
    search_query: str
    documents: List[RetrievalDocument] = field(default_factory=list)
    low_confidence: bool = False
    best_score: float | None = None
    raw_recalled: int = 0

    @property
    def context_text(self) -> str:
        parts = []
        for doc in self.documents:
            parts.append(f"[{doc.citation_id}] {doc.content}")
        return "\n\n".join(parts)

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "search_query": self.search_query,
            "documents": [d.to_dict() for d in self.documents],
            "low_confidence": self.low_confidence,
            "best_score": self.best_score,
            "raw_recalled": self.raw_recalled,
            "context_text": self.context_text,
        }


def passes_retrieval_threshold(
    doc: LangchainDocument,
    score_threshold: float | None = None,
) -> bool:
    threshold = (
        score_threshold
        if score_threshold is not None
        else settings.retrieval_score_threshold
    )
    return _passes_threshold(doc, threshold)


def build_retrieval_quality_payload(
    docs: List[LangchainDocument],
    *,
    raw_recalled: int,
) -> Dict[str, Any]:
    scores = []
    for doc in docs:
        raw = (doc.metadata or {}).get(RETRIEVAL_SCORE_METADATA_KEY)
        try:
            scores.append(float(raw))
        except (TypeError, ValueError):
            pass
    low_confidence = len(docs) == 0
    reason = None
    if low_confidence:
        reason = (
            "below_score_threshold"
            if raw_recalled > 0 and settings.retrieval_score_threshold is not None
            else "no_relevant_context"
        )
    payload: Dict[str, Any] = {
        "low_confidence": low_confidence,
        "confidence_reason": reason,
        "score_mode": settings.retrieval_score_mode,
        "score_threshold": settings.retrieval_score_threshold,
        "recalled_count": raw_recalled,
        "selected_count": len(docs),
    }
    if scores:
        payload["best_score"] = (
            max(scores)
            if settings.retrieval_score_mode == "similarity"
            else min(scores)
        )
    return payload


def retrieval_result_to_langchain_documents(
    result: RetrievalResult,
) -> List[LangchainDocument]:
    docs: List[LangchainDocument] = []
    for item in result.documents:
        meta = dict(item.metadata)
        if item.score is not None:
            meta[RETRIEVAL_SCORE_METADATA_KEY] = item.score
        docs.append(LangchainDocument(page_content=item.content, metadata=meta))
    return docs


def _passes_threshold(doc: LangchainDocument, threshold: float | None) -> bool:
    raw = (doc.metadata or {}).get(RETRIEVAL_SCORE_METADATA_KEY)
    try:
        score = float(raw)
    except (TypeError, ValueError):
        return True
    if threshold is None:
        return True
    if settings.retrieval_score_mode == "similarity":
        return score >= threshold
    return score <= threshold


def _build_vector_stores(
    db: Session,
    user_id: int,
    knowledge_base_uuids: Sequence[str],
) -> tuple[list[Any], list[str], dict[str, KnowledgeBase]]:
    embeddings, embedding_runtime = create_user_embeddings_with_runtime(db, user_id)
    cache_key = embedding_runtime_cache_key(embedding_runtime)

    stores: list[Any] = []
    kb_uuids: list[str] = []
    kb_by_uuid: dict[str, KnowledgeBase] = {}

    for ref in knowledge_base_uuids:
        kb = get_kb_for_user(db, ref, user_id)
        if not kb:
            continue
        has_documents = (
            db.query(Document.id)
            .filter(Document.knowledge_base_id == kb.id)
            .limit(1)
            .first()
        )
        if not has_documents:
            continue
        stores.append(
            get_kb_vector_store(
                user_id=user_id,
                kb_id=kb.id,
                embedding_function=embeddings,
                embedding_cache_key=cache_key,
            )
        )
        kb_uuids.append(kb.uuid)
        kb_by_uuid[kb.uuid] = kb

    return stores, kb_uuids, kb_by_uuid


async def retrieve_context(
    db: Session,
    user_id: int,
    query: str,
    knowledge_base_uuids: Sequence[str],
    *,
    top_k: int = 12,
    score_threshold: float | None = None,
) -> RetrievalResult:
    """Retrieve merged context from one or more knowledge bases."""
    search_query = query.strip()
    stores, kb_uuids, kb_by_uuid = _build_vector_stores(db, user_id, knowledge_base_uuids)

    if not stores:
        return RetrievalResult(
            query=query,
            search_query=search_query,
            low_confidence=True,
        )

    raw_docs = await retrieve_from_knowledge_bases(
        search_query,
        stores,
        kb_uuids,
        max_docs=top_k,
    )

    threshold = (
        score_threshold
        if score_threshold is not None
        else settings.retrieval_score_threshold
    )
    filtered: list[LangchainDocument] = []
    for doc in raw_docs:
        meta = dict(doc.metadata or {})
        kb_uuid = meta.get("kb_uuid")
        if kb_uuid and kb_uuid in kb_by_uuid:
            meta["kb_name"] = kb_by_uuid[kb_uuid].name
        doc.metadata = meta
        if _passes_threshold(doc, threshold):
            filtered.append(doc)

    documents: list[RetrievalDocument] = []
    scores: list[float] = []
    for idx, doc in enumerate(filtered, start=1):
        meta = dict(doc.metadata or {})
        raw_score = meta.get(RETRIEVAL_SCORE_METADATA_KEY)
        score = float(raw_score) if raw_score is not None else None
        if score is not None:
            scores.append(score)
        documents.append(
            RetrievalDocument(
                content=doc.page_content or "",
                metadata=meta,
                score=score,
                citation_id=idx,
            )
        )

    best_score = None
    if scores:
        best_score = (
            max(scores)
            if settings.retrieval_score_mode == "similarity"
            else min(scores)
        )

    low_confidence = len(documents) == 0

    return RetrievalResult(
        query=query,
        search_query=search_query,
        documents=documents,
        low_confidence=low_confidence,
        best_score=best_score,
        raw_recalled=len(raw_docs),
    )
