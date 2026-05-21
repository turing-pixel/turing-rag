"""Add llm_provider and llm_model to chats

Revision ID: add_chat_llm_config
Revises: add_kb_icon_color
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_chat_llm_config"
down_revision: Union[str, None] = "add_kb_icon_color"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chats", sa.Column("llm_provider", sa.String(length=50), nullable=True))
    op.add_column("chats", sa.Column("llm_model", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("chats", "llm_model")
    op.drop_column("chats", "llm_provider")
