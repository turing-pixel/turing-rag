"""Add public_id (ULID) to users for external API identifiers

Revision ID: add_user_public_id
Revises: add_chat_uuid
Create Date: 2026-05-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from ulid import ULID


revision: str = "add_user_public_id"
down_revision: Union[str, None] = "add_chat_uuid"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("public_id", sa.String(length=26), nullable=True))
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM users")).fetchall()
    for (row_id,) in rows:
        connection.execute(
            sa.text("UPDATE users SET public_id = :public_id WHERE id = :id"),
            {"public_id": str(ULID()), "id": row_id},
        )
    op.alter_column("users", "public_id", nullable=False)
    op.create_index(op.f("ix_users_public_id"), "users", ["public_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_public_id"), table_name="users")
    op.drop_column("users", "public_id")
