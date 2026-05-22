"""Add embedding_configs table

Revision ID: add_embedding_configs
Revises: add_task_progress
Create Date: 2026-05-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_embedding_configs"
down_revision: Union[str, None] = "add_task_progress"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "embedding_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("api_base", sa.String(length=512), nullable=True),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_embedding_configs_id"), "embedding_configs", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_embedding_configs_user_id"),
        "embedding_configs",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_embedding_configs_user_id"), table_name="embedding_configs")
    op.drop_index(op.f("ix_embedding_configs_id"), table_name="embedding_configs")
    op.drop_table("embedding_configs")
