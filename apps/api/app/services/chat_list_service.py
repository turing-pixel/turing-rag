"""Lightweight chat list rows without loading full message bodies."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased, joinedload

from app.models.chat import Chat, Message
from app.services.citation_markdown import normalize_citation_markdown


def _preview_text(content: str, role: str) -> str:
    if not content:
        return ""
    text = normalize_citation_markdown(content) if role == "assistant" else content
    for marker in ("[citation](", "[citation:", "[Citation:"):
        while marker in text:
            start = text.find(marker)
            if start == -1:
                break
            end = text.find(")", start) if marker == "[citation](" else text.find("]", start)
            if end == -1:
                break
            text = (text[:start] + text[end + 1 :]).strip()
    text = " ".join(text.split())
    return text[:280] + ("..." if len(text) > 280 else "")


def build_chat_summaries(
    db: Session,
    *,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
) -> List[dict[str, Any]]:
    latest_id_subq = (
        db.query(
            Message.chat_id.label("chat_id"),
            func.max(Message.id).label("latest_message_id"),
        )
        .group_by(Message.chat_id)
        .subquery()
    )

    count_subq = (
        db.query(
            Message.chat_id.label("chat_id"),
            func.count(Message.id).label("message_count"),
        )
        .group_by(Message.chat_id)
        .subquery()
    )

    LatestMessage = aliased(Message)

    rows = (
        db.query(
            Chat,
            LatestMessage,
            count_subq.c.message_count,
        )
        .options(joinedload(Chat.knowledge_bases))
        .outerjoin(latest_id_subq, Chat.id == latest_id_subq.c.chat_id)
        .outerjoin(
            LatestMessage,
            LatestMessage.id == latest_id_subq.c.latest_message_id,
        )
        .outerjoin(count_subq, Chat.id == count_subq.c.chat_id)
        .filter(Chat.user_id == user_id)
        .order_by(Chat.updated_at.desc(), Chat.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    summaries: List[dict[str, Any]] = []
    for chat, latest_msg, message_count in rows:
        preview: Optional[str] = None
        last_role: Optional[str] = None
        last_at: Optional[datetime] = None
        if latest_msg is not None:
            last_role = latest_msg.role
            last_at = latest_msg.updated_at or latest_msg.created_at
            preview = _preview_text(latest_msg.content, latest_msg.role)

        knowledge_bases = getattr(chat, "knowledge_bases", None) or []
        summaries.append(
            {
                "uuid": chat.uuid,
                "title": chat.title,
                "created_at": chat.created_at,
                "updated_at": chat.updated_at,
                "knowledge_base_uuids": [kb.uuid for kb in knowledge_bases],
                "llm_config_id": getattr(chat, "llm_config_id", None),
                "llm_provider": getattr(chat, "llm_provider", None),
                "llm_model": getattr(chat, "llm_model", None),
                "message_count": int(message_count or 0),
                "last_message_role": last_role,
                "last_message_preview": preview or None,
                "last_message_at": last_at,
            }
        )

    return summaries
