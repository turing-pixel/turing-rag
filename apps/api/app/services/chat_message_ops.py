"""Message update, feedback, and regenerate helpers."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.chat import Chat, Message


def get_owned_message(
    db: Session,
    *,
    chat_id: int,
    message_id: int,
    user_id: int,
) -> Optional[Message]:
    return (
        db.query(Message)
        .join(Chat, Message.chat_id == Chat.id)
        .filter(
            Message.id == message_id,
            Message.chat_id == chat_id,
            Chat.user_id == user_id,
        )
        .first()
    )


def delete_messages_after(
    db: Session, *, chat_id: int, after_message_id: int
) -> None:
    db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.id > after_message_id,
    ).delete(synchronize_session=False)


def delete_messages_from(
    db: Session, *, chat_id: int, from_message_id: int, inclusive: bool = True
) -> None:
    query = db.query(Message).filter(Message.chat_id == chat_id)
    if inclusive:
        query = query.filter(Message.id >= from_message_id)
    else:
        query = query.filter(Message.id > from_message_id)
    query.delete(synchronize_session=False)


def get_previous_user_message(
    db: Session, *, chat_id: int, before_message_id: int
) -> Optional[Message]:
    return (
        db.query(Message)
        .filter(
            Message.chat_id == chat_id,
            Message.role == "user",
            Message.id < before_message_id,
        )
        .order_by(Message.id.desc())
        .first()
    )
