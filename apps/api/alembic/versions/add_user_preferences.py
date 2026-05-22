"""Add user_preferences table and backfill from is_default flags

Revision ID: add_user_preferences
Revises: add_embedding_configs
Create Date: 2026-05-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_user_preferences"
down_revision: Union[str, None] = "add_embedding_configs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SOURCE_ENV = "env"
SOURCE_CONFIG = "config"


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("default_llm_source", sa.String(length=20), nullable=False),
        sa.Column("default_llm_config_id", sa.Integer(), nullable=True),
        sa.Column("default_embedding_source", sa.String(length=20), nullable=False),
        sa.Column("default_embedding_config_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["default_llm_config_id"],
            ["llm_configs.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["default_embedding_config_id"],
            ["embedding_configs.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )

    conn = op.get_bind()
    user_ids = [
        row[0]
        for row in conn.execute(sa.text("SELECT id FROM users")).fetchall()
    ]

    for user_id in user_ids:
        llm_row = conn.execute(
            sa.text(
                """
                SELECT id FROM llm_configs
                WHERE user_id = :uid AND is_active = true AND is_default = true
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ),
            {"uid": user_id},
        ).fetchone()
        emb_row = conn.execute(
            sa.text(
                """
                SELECT id FROM embedding_configs
                WHERE user_id = :uid AND is_active = true AND is_default = true
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ),
            {"uid": user_id},
        ).fetchone()

        llm_source = SOURCE_CONFIG if llm_row else SOURCE_ENV
        llm_config_id = llm_row[0] if llm_row else None
        emb_source = SOURCE_CONFIG if emb_row else SOURCE_ENV
        emb_config_id = emb_row[0] if emb_row else None

        conn.execute(
            sa.text(
                """
                INSERT INTO user_preferences (
                    user_id,
                    default_llm_source,
                    default_llm_config_id,
                    default_embedding_source,
                    default_embedding_config_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    :user_id,
                    :llm_source,
                    :llm_config_id,
                    :emb_source,
                    :emb_config_id,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            ),
            {
                "user_id": user_id,
                "llm_source": llm_source,
                "llm_config_id": llm_config_id,
                "emb_source": emb_source,
                "emb_config_id": emb_config_id,
            },
        )

    conn.execute(sa.text("UPDATE llm_configs SET is_default = false"))
    conn.execute(sa.text("UPDATE embedding_configs SET is_default = false"))


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT user_id, default_llm_config_id, default_embedding_config_id,
                   default_llm_source, default_embedding_source
            FROM user_preferences
            """
        )
    ).fetchall()

    for row in rows:
        user_id, llm_id, emb_id, llm_source, emb_source = row
        if llm_source == SOURCE_CONFIG and llm_id is not None:
            conn.execute(
                sa.text(
                    "UPDATE llm_configs SET is_default = true WHERE id = :id AND user_id = :uid"
                ),
                {"id": llm_id, "uid": user_id},
            )
        if emb_source == SOURCE_CONFIG and emb_id is not None:
            conn.execute(
                sa.text(
                    """
                    UPDATE embedding_configs SET is_default = true
                    WHERE id = :id AND user_id = :uid
                    """
                ),
                {"id": emb_id, "uid": user_id},
            )

    op.drop_table("user_preferences")
