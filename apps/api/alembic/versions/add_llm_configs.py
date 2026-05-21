"""Add llm_configs table and chat.llm_config_id

Revision ID: add_llm_configs
Revises: add_chat_llm_config
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_llm_configs"
down_revision: Union[str, None] = "add_chat_llm_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "llm_configs",
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
    op.create_index(op.f("ix_llm_configs_id"), "llm_configs", ["id"], unique=False)
    op.create_index(op.f("ix_llm_configs_user_id"), "llm_configs", ["user_id"], unique=False)

    op.add_column("chats", sa.Column("llm_config_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_chats_llm_config_id",
        "chats",
        "llm_configs",
        ["llm_config_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_chats_llm_config_id", "chats", type_="foreignkey")
    op.drop_column("chats", "llm_config_id")
    op.drop_index(op.f("ix_llm_configs_user_id"), table_name="llm_configs")
    op.drop_index(op.f("ix_llm_configs_id"), table_name="llm_configs")
    op.drop_table("llm_configs")
