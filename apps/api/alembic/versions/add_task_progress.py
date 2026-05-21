"""Add progress fields to processing_tasks

Revision ID: add_task_progress
Revises: add_llm_configs
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_task_progress"
down_revision: Union[str, None] = "add_llm_configs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "processing_tasks",
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "processing_tasks",
        sa.Column("progress_message", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("processing_tasks", "progress_message")
    op.drop_column("processing_tasks", "progress")
