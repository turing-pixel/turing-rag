"""Map ORM chat/message rows to API schemas (public UUID for chat id)."""

from __future__ import annotations

from typing import Any

from app.models.chat import Chat, Message
from app.schemas.chat import ChatResponse, ChatSummaryResponse, MessageResponse


def message_to_response(message: Message, chat_uuid: str) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        chat_id=chat_uuid,
        content=message.content,
        role=message.role,
        feedback=message.feedback,
        created_at=message.created_at,
        updated_at=message.updated_at,
    )


def chat_to_response(chat: Chat) -> ChatResponse:
    messages = sorted(
        getattr(chat, "messages", None) or [],
        key=lambda m: m.id,
    )
    knowledge_bases = getattr(chat, "knowledge_bases", None) or []
    return ChatResponse(
        id=chat.uuid,
        title=chat.title,
        user_id=chat.user_id,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        messages=[message_to_response(m, chat.uuid) for m in messages],
        knowledge_base_ids=[kb.id for kb in knowledge_bases],
        llm_config_id=getattr(chat, "llm_config_id", None),
        llm_provider=getattr(chat, "llm_provider", None),
        llm_model=getattr(chat, "llm_model", None),
    )


def chat_to_summary(chat: Chat, summary: dict[str, Any]) -> ChatSummaryResponse:
    return ChatSummaryResponse(
        id=chat.uuid,
        title=chat.title,
        user_id=chat.user_id,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        knowledge_base_ids=summary.get("knowledge_base_ids") or [],
        llm_config_id=summary.get("llm_config_id"),
        llm_provider=summary.get("llm_provider"),
        llm_model=summary.get("llm_model"),
        message_count=summary.get("message_count") or 0,
        last_message_role=summary.get("last_message_role"),
        last_message_preview=summary.get("last_message_preview"),
        last_message_at=summary.get("last_message_at"),
    )
