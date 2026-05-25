"""Add workflow tables and seed system templates

Revision ID: add_workflow_tables
Revises: add_msg_retrieval_sources
Create Date: 2026-05-23
"""

from typing import Sequence, Union

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "add_workflow_tables"
down_revision: Union[str, None] = "add_msg_retrieval_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=64), nullable=False, server_default="general"),
        sa.Column("input_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("step_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("output_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("default_graph", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_workflow_templates_key", "workflow_templates", ["key"], unique=True)

    op.create_table(
        "workflow_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", sa.String(length=26), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("workflow_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("resolved_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("graph", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "llm_config_id",
            sa.Integer(),
            sa.ForeignKey("llm_configs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_workflow_definitions_uuid", "workflow_definitions", ["uuid"], unique=True)
    op.create_index("ix_workflow_definitions_user_id", "workflow_definitions", ["user_id"])
    op.create_index("ix_workflow_definitions_template_key", "workflow_definitions", ["template_key"])

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", sa.String(length=26), nullable=False),
        sa.Column(
            "workflow_id",
            sa.Integer(),
            sa.ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("input", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("output", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("definition_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_workflow_runs_uuid", "workflow_runs", ["uuid"], unique=True)
    op.create_index("ix_workflow_runs_workflow_id", "workflow_runs", ["workflow_id"])
    op.create_index("ix_workflow_runs_status", "workflow_runs", ["status"])

    op.create_table(
        "workflow_run_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("step_key", sa.String(length=128), nullable=False),
        sa.Column("step_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("input", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("citations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("token_usage", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_workflow_run_steps_run_id", "workflow_run_steps", ["run_id"])

    op.create_table(
        "workflow_webhooks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "workflow_id",
            sa.Integer(),
            sa.ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("secret", sa.String(length=255), nullable=True),
        sa.Column("events", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_workflow_webhooks_workflow_id", "workflow_webhooks", ["workflow_id"])

    op.create_table(
        "workflow_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", sa.String(length=26), nullable=False),
        sa.Column(
            "workflow_id",
            sa.Integer(),
            sa.ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cron_expression", sa.String(length=128), nullable=False),
        sa.Column("input_defaults", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_workflow_schedules_uuid", "workflow_schedules", ["uuid"], unique=True)
    op.create_index("ix_workflow_schedules_workflow_id", "workflow_schedules", ["workflow_id"])

    _seed_templates()


def _seed_templates() -> None:
    from app.services.workflow.templates.registry import SYSTEM_TEMPLATES

    conn = op.get_bind()
    now = sa.text("NOW()")
    for tpl in SYSTEM_TEMPLATES:
        conn.execute(
            sa.text(
                """
                INSERT INTO workflow_templates
                (key, name, description, category, input_schema, step_schema,
                 output_schema, default_graph, is_system, created_at, updated_at)
                VALUES
                (:key, :name, :description, :category,
                 CAST(:input_schema AS jsonb),
                 CAST(:step_schema AS jsonb),
                 CAST(:output_schema AS jsonb),
                 CAST(:default_graph AS jsonb),
                 true, NOW(), NOW())
                """
            ),
            {
                "key": tpl["key"],
                "name": tpl["name"],
                "description": tpl.get("description"),
                "category": tpl.get("category", "general"),
                "input_schema": json.dumps(tpl.get("input_schema") or {}),
                "step_schema": json.dumps(tpl.get("steps") or []),
                "output_schema": json.dumps(tpl.get("output_schema"))
                if tpl.get("output_schema")
                else None,
                "default_graph": json.dumps(tpl.get("default_graph"))
                if tpl.get("default_graph")
                else None,
            },
        )


def downgrade() -> None:
    op.drop_table("workflow_schedules")
    op.drop_table("workflow_webhooks")
    op.drop_table("workflow_run_steps")
    op.drop_table("workflow_runs")
    op.drop_table("workflow_definitions")
    op.drop_table("workflow_templates")
