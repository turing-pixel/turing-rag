"""Drop cover from knowledge_bases

Revision ID: drop_kb_cover
Revises: add_kb_icon
Create Date: 2026-05-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_kb_cover"
down_revision: Union[str, None] = "add_kb_icon"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("knowledge_bases", "cover")


def downgrade() -> None:
    op.add_column(
        "knowledge_bases",
        sa.Column("cover", sa.String(length=512), nullable=True),
    )
