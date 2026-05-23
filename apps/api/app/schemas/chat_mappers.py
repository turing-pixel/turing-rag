"""Map ORM chat/message rows to API schemas (public UUID for chat id)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.chat import Chat, Message
from app.services.message_retrieval_persistence import load_sources_by_message_id
from app.schemas.chat import (
    ChatResponse,
    ChatSummaryResponse,
    MessageResponse,
    MessageRetrievalResponse,
    MessageSourceResponse,
)


def _retrieval_to_response(raw: Optional[dict]) -> Optional[MessageRetrievalResponse]:
    if not raw:
        return None
    return MessageRetrievalResponse.model_validate(raw)


def message_to_response(
    message: Message,
    chat_uuid: str,
    *,
    sources: Optional[List[Dict[str, Any]]] = None,
) -> MessageResponse:
    retrieval = (
        _retrieval_to_response(message.retrieval)
        if message.role == "assistant"
        else None
    )
    source_rows = sources or []
    return MessageResponse(
        id=message.id,
        chat_uuid=chat_uuid,
        content=message.content,
        role=message.role,
        feedback=message.feedback,
        retrieval=retrieval,
        sources=[MessageSourceResponse.model_validate(s) for s in source_rows],
        created_at=message.created_at,
        updated_at=message.updated_at,
    )


def chat_to_response(
    chat: Chat,
    *,
    sources_by_message: Optional[Dict[int, List[Dict[str, Any]]]] = None,
) -> ChatResponse:
    messages = sorted(
        getattr(chat, "messages", None) or [],
        key=lambda m: m.id,
    )
    knowledge_bases = getattr(chat, "knowledge_bases", None) or []
    by_msg = sources_by_message or {}
    return ChatResponse(
        uuid=chat.uuid,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        messages=[
            message_to_response(
                m,
                chat.uuid,
                sources=by_msg.get(m.id) if m.role == "assistant" else None,
            )
            for m in messages
        ],
        knowledge_base_uuids=[kb.uuid for kb in knowledge_bases],
        llm_config_id=getattr(chat, "llm_config_id", None),
        llm_provider=getattr(chat, "llm_provider", None),
        llm_model=getattr(chat, "llm_model", None),
    )


def sources_by_message_for_chat(db: Session, chat: Chat) -> Dict[int, List[Dict[str, Any]]]:
    messages = getattr(chat, "messages", None) or []
    assistant_ids = [m.id for m in messages if m.role == "assistant"]
    return load_sources_by_message_id(db, assistant_ids)


def chat_to_response_with_sources(db: Session, chat: Chat) -> ChatResponse:
    return chat_to_response(
        chat,
        sources_by_message=sources_by_message_for_chat(db, chat),
    )


def chat_to_summary(chat: Chat, summary: dict[str, Any]) -> ChatSummaryResponse:
    return ChatSummaryResponse(
        uuid=chat.uuid,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        knowledge_base_uuids=summary.get("knowledge_base_uuids") or [],
        llm_config_id=summary.get("llm_config_id"),
        llm_provider=summary.get("llm_provider"),
        llm_model=summary.get("llm_model"),
        message_count=summary.get("message_count") or 0,
        last_message_role=summary.get("last_message_role"),
        last_message_preview=summary.get("last_message_preview"),
        last_message_at=summary.get("last_message_at"),
    )
