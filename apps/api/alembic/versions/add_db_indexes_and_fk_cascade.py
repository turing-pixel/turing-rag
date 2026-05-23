"""Add query indexes, drop redundant PK indexes, set ON DELETE CASCADE

Revision ID: add_db_indexes_and_fk_cascade
Revises: add_user_public_id
Create Date: 2026-05-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_db_indexes_and_fk_cascade"
down_revision: Union[str, None] = "add_user_public_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Redundant with PRIMARY KEY: (index_name, table_name)
_REDUNDANT_PK_INDEXES: list[tuple[str, str]] = [
    ("ix_users_id", "users"),
    ("ix_knowledge_bases_id", "knowledge_bases"),
    ("ix_documents_id", "documents"),
    ("ix_document_uploads_id", "document_uploads"),
    ("ix_processing_tasks_id", "processing_tasks"),
    ("ix_chats_id", "chats"),
    ("ix_messages_id", "messages"),
    ("ix_api_keys_id", "api_keys"),
    ("ix_llm_configs_id", "llm_configs"),
    ("ix_embedding_configs_id", "embedding_configs"),
]

# (table, column) -> ondelete for FKs that reference another table's id
_FK_ONDELETE: list[tuple[str, str, str, str]] = [
    # user-owned rows
    ("knowledge_bases", "user_id", "users", "CASCADE"),
    ("chats", "user_id", "users", "CASCADE"),
    ("api_keys", "user_id", "users", "CASCADE"),
    ("llm_configs", "user_id", "users", "CASCADE"),
    ("embedding_configs", "user_id", "users", "CASCADE"),
    ("user_preferences", "user_id", "users", "CASCADE"),
    # chat children
    ("messages", "chat_id", "chats", "CASCADE"),
    ("chat_knowledge_bases", "chat_id", "chats", "CASCADE"),
    ("chat_knowledge_bases", "knowledge_base_id", "knowledge_bases", "CASCADE"),
    # knowledge base children
    ("documents", "knowledge_base_id", "knowledge_bases", "CASCADE"),
    ("document_chunks", "kb_id", "knowledge_bases", "CASCADE"),
    ("processing_tasks", "knowledge_base_id", "knowledge_bases", "CASCADE"),
    # document children
    ("document_chunks", "document_id", "documents", "CASCADE"),
    ("processing_tasks", "document_id", "documents", "SET NULL"),
    ("processing_tasks", "document_upload_id", "document_uploads", "SET NULL"),
]


def _replace_fk_ondelete(
    inspector: sa.Inspector,
    table: str,
    column: str,
    referent: str,
    ondelete: str,
) -> None:
    for fk in inspector.get_foreign_keys(table):
        if fk["constrained_columns"] != [column]:
            continue
        if fk["referred_table"] != referent:
            continue
        name = fk["name"]
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            name,
            table,
            referent,
            [column],
            ["id"],
            ondelete=ondelete,
        )
        return
    raise RuntimeError(f"FK not found: {table}.{column} -> {referent}.id")


def upgrade() -> None:
    op.create_index(
        "ix_chats_user_id_updated_at",
        "chats",
        ["user_id", "updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_messages_chat_id_id",
        "messages",
        ["chat_id", "id"],
        unique=False,
    )
    op.create_index(
        "ix_knowledge_bases_user_id",
        "knowledge_bases",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_documents_knowledge_base_id",
        "documents",
        ["knowledge_base_id"],
        unique=False,
    )

    for index_name, table_name in _REDUNDANT_PK_INDEXES:
        op.drop_index(index_name, table_name=table_name)

    for table, column, referent, ondelete in _FK_ONDELETE:
        inspector = sa.inspect(op.get_bind())
        _replace_fk_ondelete(inspector, table, column, referent, ondelete)


def downgrade() -> None:
    for table, column, referent, _ondelete in reversed(_FK_ONDELETE):
        inspector = sa.inspect(op.get_bind())
        _replace_fk_ondelete(inspector, table, column, referent, "NO ACTION")

    op.drop_index("ix_documents_knowledge_base_id", table_name="documents")
    op.drop_index("ix_knowledge_bases_user_id", table_name="knowledge_bases")
    op.drop_index("ix_messages_chat_id_id", table_name="messages")
    op.drop_index("ix_chats_user_id_updated_at", table_name="chats")

    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_knowledge_bases_id"), "knowledge_bases", ["id"], unique=False)
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)
    op.create_index(op.f("ix_document_uploads_id"), "document_uploads", ["id"], unique=False)
    op.create_index(op.f("ix_processing_tasks_id"), "processing_tasks", ["id"], unique=False)
    op.create_index(op.f("ix_chats_id"), "chats", ["id"], unique=False)
    op.create_index(op.f("ix_messages_id"), "messages", ["id"], unique=False)
    op.create_index(op.f("ix_api_keys_id"), "api_keys", ["id"], unique=False)
    op.create_index(op.f("ix_llm_configs_id"), "llm_configs", ["id"], unique=False)
    op.create_index(op.f("ix_embedding_configs_id"), "embedding_configs", ["id"], unique=False)
