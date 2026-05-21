"""Add icon_color to knowledge_bases

Revision ID: add_kb_icon_color
Revises: drop_kb_cover
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_kb_icon_color"
down_revision: Union[str, None] = "drop_kb_cover"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "knowledge_bases",
        sa.Column("icon_color", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("knowledge_bases", "icon_color")
