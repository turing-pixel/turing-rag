"""Drop icon_index from knowledge_bases

Revision ID: drop_kb_icon_index
Revises: add_kb_cover
Create Date: 2026-05-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_kb_icon_index"
down_revision: Union[str, None] = "add_kb_cover"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("knowledge_bases", "icon_index")


def downgrade() -> None:
    op.add_column(
        "knowledge_bases",
        sa.Column("icon_index", sa.Integer(), nullable=True),
    )
