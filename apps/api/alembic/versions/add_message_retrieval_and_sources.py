"""Add messages.retrieval JSONB and message_sources table

Revision ID: add_message_retrieval_and_sources
Revises: unify_uuid_columns
Create Date: 2026-05-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "add_msg_retrieval_sources"
down_revision: Union[str, None] = "unify_uuid_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("retrieval", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_table(
        "message_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        sa.Column(
            "chunk_id",
            sa.String(length=64),
            sa.ForeignKey("document_chunks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kb_uuid", sa.String(length=26), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.UniqueConstraint("message_id", "rank", name="uq_message_sources_message_rank"),
    )
    op.create_index(
        "ix_message_sources_message_id",
        "message_sources",
        ["message_id"],
    )
    op.create_index(
        "ix_message_sources_chunk_id",
        "message_sources",
        ["chunk_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_message_sources_chunk_id", table_name="message_sources")
    op.drop_index("ix_message_sources_message_id", table_name="message_sources")
    op.drop_table("message_sources")
    op.drop_column("messages", "retrieval")
