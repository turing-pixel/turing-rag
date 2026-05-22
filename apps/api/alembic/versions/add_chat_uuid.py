"""Add uuid column to chats for public API identifiers

Revision ID: add_chat_uuid
Revises: add_message_feedback
Create Date: 2026-05-22
"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "add_chat_uuid"
down_revision: Union[str, None] = "add_message_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chats", sa.Column("uuid", sa.String(length=36), nullable=True))
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM chats")).fetchall()
    for (row_id,) in rows:
        connection.execute(
            sa.text("UPDATE chats SET uuid = :uuid WHERE id = :id"),
            {"uuid": str(uuid.uuid4()), "id": row_id},
        )
    op.alter_column("chats", "uuid", nullable=False)
    op.create_index(op.f("ix_chats_uuid"), "chats", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_chats_uuid"), table_name="chats")
    op.drop_column("chats", "uuid")
