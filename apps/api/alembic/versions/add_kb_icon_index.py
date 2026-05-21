"""Add icon_index to knowledge_bases

Revision ID: add_kb_icon_index
Revises: initial_schema
Create Date: 2026-05-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_kb_icon_index"
down_revision: Union[str, None] = "initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "knowledge_bases",
        sa.Column("icon_index", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("knowledge_bases", "icon_index")
