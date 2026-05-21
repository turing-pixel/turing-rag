"""Add cover to knowledge_bases

Revision ID: add_kb_cover
Revises: add_kb_icon_index
Create Date: 2026-05-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_kb_cover"
down_revision: Union[str, None] = "add_kb_icon_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "knowledge_bases",
        sa.Column("cover", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("knowledge_bases", "cover")
