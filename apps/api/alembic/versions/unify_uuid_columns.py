"""Unify external ids: users.public_id->uuid, chats ULID, knowledge_bases.uuid

Revision ID: unify_uuid_columns
Revises: add_db_indexes_and_fk_cascade
Create Date: 2026-05-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from ulid import ULID


revision: str = "unify_uuid_columns"
down_revision: Union[str, None] = "add_db_indexes_and_fk_cascade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_users_public_id"), table_name="users")
    op.alter_column("users", "public_id", new_column_name="uuid")
    op.create_index(op.f("ix_users_uuid"), "users", ["uuid"], unique=True)

    op.add_column("knowledge_bases", sa.Column("uuid", sa.String(length=26), nullable=True))
    connection = op.get_bind()
    for (row_id,) in connection.execute(sa.text("SELECT id FROM knowledge_bases")).fetchall():
        connection.execute(
            sa.text("UPDATE knowledge_bases SET uuid = :uuid WHERE id = :id"),
            {"uuid": str(ULID()), "id": row_id},
        )
    op.alter_column("knowledge_bases", "uuid", nullable=False)
    op.create_index(op.f("ix_knowledge_bases_uuid"), "knowledge_bases", ["uuid"], unique=True)

    for (row_id, old_uuid) in connection.execute(
        sa.text("SELECT id, uuid FROM chats")
    ).fetchall():
        connection.execute(
            sa.text("UPDATE chats SET uuid = :uuid WHERE id = :id"),
            {"uuid": str(ULID()), "id": row_id},
        )
    op.alter_column(
        "chats",
        "uuid",
        existing_type=sa.String(length=36),
        type_=sa.String(length=26),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "chats",
        "uuid",
        existing_type=sa.String(length=26),
        type_=sa.String(length=36),
        existing_nullable=False,
    )

    op.drop_index(op.f("ix_knowledge_bases_uuid"), table_name="knowledge_bases")
    op.drop_column("knowledge_bases", "uuid")

    op.drop_index(op.f("ix_users_uuid"), table_name="users")
    op.alter_column("users", "uuid", new_column_name="public_id")
    op.create_index(op.f("ix_users_public_id"), "users", ["public_id"], unique=True)
