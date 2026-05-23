"""Persist and load assistant message retrieval metadata and sources."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from langchain_core.documents import Document as LangchainDocument
from sqlalchemy.orm import Session, joinedload

from app.models.chat import Message, MessageSource
from app.models.knowledge import Document, DocumentChunk, KnowledgeBase
RETRIEVAL_PREVIEW_MAX_LEN = 160
RETRIEVAL_SCORE_METADATA_KEY = "retrieval_score"
EXCERPT_MAX_LEN = 512


def _preview_text(text: str) -> str:
    normalized = (text or "").replace("\n", " ")
    if len(normalized) <= RETRIEVAL_PREVIEW_MAX_LEN:
        return normalized
    return normalized[:RETRIEVAL_PREVIEW_MAX_LEN] + "..."


def _excerpt_text(text: str) -> str:
    normalized = (text or "").strip()
    if len(normalized) <= EXCERPT_MAX_LEN:
        return normalized
    return normalized[:EXCERPT_MAX_LEN] + "..."


def _score_from_metadata(meta: dict) -> Optional[float]:
    raw = meta.get(RETRIEVAL_SCORE_METADATA_KEY)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def build_retrieval_payload(
    *,
    user_query: str,
    search_query: Optional[str],
    rewrite_attempted: bool,
    knowledge_bases: List[Dict[str, str]],
    events: List[Dict[str, Any]],
    quality: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "user_query": user_query,
        "search_query": search_query,
        "rewrite_attempted": rewrite_attempted,
        "knowledge_bases": knowledge_bases,
        "events": events,
        **quality,
    }


def persist_message_retrieval(
    db: Session,
    message: Message,
    *,
    user_query: str,
    search_query: Optional[str],
    rewrite_attempted: bool,
    knowledge_bases: List[Dict[str, str]],
    events: List[Dict[str, Any]],
    retrieved_docs: List[LangchainDocument],
    quality: Dict[str, Any],
) -> None:
    """Replace sources and store retrieval JSON on an assistant message."""
    db.query(MessageSource).filter(MessageSource.message_id == message.id).delete(
        synchronize_session=False
    )

    message.retrieval = build_retrieval_payload(
        user_query=user_query,
        search_query=search_query,
        rewrite_attempted=rewrite_attempted,
        knowledge_bases=knowledge_bases,
        events=events,
        quality=quality,
    )

    for rank, doc in enumerate(retrieved_docs or [], start=1):
        meta = dict(doc.metadata or {})
        chunk_id = meta.get("chunk_id")
        if isinstance(chunk_id, str):
            chunk_id = chunk_id.strip() or None
        else:
            chunk_id = None

        document_id = meta.get("document_id")
        if document_id is None:
            continue

        kb_uuid = meta.get("kb_uuid")
        if not isinstance(kb_uuid, str) or not kb_uuid.strip():
            continue

        db.add(
            MessageSource(
                message_id=message.id,
                rank=rank,
                chunk_id=chunk_id,
                document_id=int(document_id),
                kb_uuid=kb_uuid.strip(),
                score=_score_from_metadata(meta),
                excerpt=_excerpt_text(doc.page_content or ""),
            )
        )


def _chunk_page_content(chunk: Optional[DocumentChunk]) -> Optional[str]:
    if chunk is None:
        return None
    meta = chunk.chunk_metadata
    if isinstance(meta, dict):
        text = meta.get("page_content")
        if isinstance(text, str) and text.strip():
            return text
    return None


def load_sources_by_message_id(
    db: Session, message_ids: List[int]
) -> Dict[int, List[Dict[str, Any]]]:
    if not message_ids:
        return {}

    rows = (
        db.query(MessageSource)
        .options(
            joinedload(MessageSource.document),
            joinedload(MessageSource.chunk),
        )
        .filter(MessageSource.message_id.in_(message_ids))
        .order_by(MessageSource.message_id.asc(), MessageSource.rank.asc())
        .all()
    )

    kb_names: Dict[str, str] = {}
    kb_uuids = {row.kb_uuid for row in rows if row.kb_uuid}
    if kb_uuids:
        for kb in db.query(KnowledgeBase).filter(KnowledgeBase.uuid.in_(kb_uuids)).all():
            kb_names[kb.uuid] = kb.name

    out: Dict[int, List[Dict[str, Any]]] = {}
    for row in rows:
        doc: Optional[Document] = row.document
        file_name = doc.file_name if doc else ""
        chunk_text = _chunk_page_content(row.chunk)
        stale = row.chunk_id is not None and chunk_text is None
        text = chunk_text if chunk_text is not None else row.excerpt

        out.setdefault(row.message_id, []).append(
            {
                "rank": row.rank,
                "chunk_id": row.chunk_id,
                "document_id": row.document_id,
                "kb_uuid": row.kb_uuid,
                "kb_name": kb_names.get(row.kb_uuid),
                "file_name": file_name,
                "score": row.score,
                "excerpt": row.excerpt,
                "text": text,
                "stale": stale,
                "preview": _preview_text(text or ""),
            }
        )
    return out
