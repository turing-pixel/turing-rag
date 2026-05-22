"""Resolve public chat UUIDs to ORM Chat rows."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, joinedload

from app.models.chat import Chat


def parse_chat_uuid(value: str) -> str | None:
    try:
        return str(uuid.UUID(str(value).strip()))
    except (ValueError, AttributeError, TypeError):
        return None


def get_chat_for_user_by_uuid(
    db: Session,
    chat_uuid: str,
    user_id: int,
    *,
    load_knowledge_bases: bool = False,
    load_messages: bool = False,
) -> Chat | None:
    parsed = parse_chat_uuid(chat_uuid)
    if not parsed:
        return None

    query = db.query(Chat).filter(Chat.uuid == parsed, Chat.user_id == user_id)
    if load_knowledge_bases:
        query = query.options(joinedload(Chat.knowledge_bases))
    if load_messages:
        query = query.options(joinedload(Chat.messages))
    return query.first()


def require_chat_for_user(
    db: Session,
    chat_uuid: str,
    user_id: int,
    *,
    load_knowledge_bases: bool = False,
    load_messages: bool = False,
) -> Chat:
    from fastapi import HTTPException

    chat = get_chat_for_user_by_uuid(
        db,
        chat_uuid,
        user_id,
        load_knowledge_bases=load_knowledge_bases,
        load_messages=load_messages,
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat
