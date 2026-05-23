"""Resolve knowledge base uuid to ORM rows."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.uuid_utils import normalize_uuid
from app.models.knowledge import KnowledgeBase


def get_kb_for_user(
    db: Session,
    kb_uuid: str,
    user_id: int,
) -> KnowledgeBase | None:
    parsed = normalize_uuid(kb_uuid)
    if not parsed:
        return None
    return (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.uuid == parsed, KnowledgeBase.user_id == user_id)
        .first()
    )


def require_kb_for_user(db: Session, kb_uuid: str, user_id: int) -> KnowledgeBase:
    kb = get_kb_for_user(db, kb_uuid, user_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb
