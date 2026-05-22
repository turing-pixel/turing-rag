"""Add feedback column to messages

Revision ID: add_message_feedback
Revises: add_user_preferences
Create Date: 2026-05-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_message_feedback"
down_revision: Union[str, None] = "add_user_preferences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("feedback", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "feedback")
