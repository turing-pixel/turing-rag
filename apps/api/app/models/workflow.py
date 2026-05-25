from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.uuid_utils import new_uuid
from app.models.base import Base, TimestampMixin


class WorkflowTemplate(Base, TimestampMixin):
    __tablename__ = "workflow_templates"

    id = Column(Integer, primary_key=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=False, default="general")
    input_schema = Column(JSONB, nullable=False, default=dict)
    step_schema = Column(JSONB, nullable=False, default=list)
    output_schema = Column(JSONB, nullable=True)
    default_graph = Column(JSONB, nullable=True)
    is_system = Column(Boolean, nullable=False, default=True)


class WorkflowDefinition(Base, TimestampMixin):
    __tablename__ = "workflow_definitions"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(26),
        unique=True,
        nullable=False,
        default=new_uuid,
        index=True,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id = Column(
        Integer,
        ForeignKey("workflow_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    template_key = Column(String(64), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    config = Column(JSONB, nullable=False, default=dict)
    resolved_steps = Column(JSONB, nullable=False, default=list)
    graph = Column(JSONB, nullable=True)
    llm_config_id = Column(
        Integer, ForeignKey("llm_configs.id", ondelete="SET NULL"), nullable=True
    )
    is_active = Column(Boolean, nullable=False, default=True)

    template = relationship("WorkflowTemplate")
    runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete")
    webhooks = relationship(
        "WorkflowWebhook", back_populates="workflow", cascade="all, delete"
    )
    schedules = relationship(
        "WorkflowSchedule", back_populates="workflow", cascade="all, delete"
    )


class WorkflowRun(Base, TimestampMixin):
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(26),
        unique=True,
        nullable=False,
        default=new_uuid,
        index=True,
    )
    workflow_id = Column(
        Integer,
        ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(32), nullable=False, default="pending", index=True)
    input = Column(JSONB, nullable=False, default=dict)
    output = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    template_key = Column(String(64), nullable=False)
    definition_snapshot = Column(JSONB, nullable=False, default=dict)
    cancelled_at = Column(DateTime, nullable=True)

    workflow = relationship("WorkflowDefinition", back_populates="runs")
    steps = relationship(
        "WorkflowRunStep", back_populates="run", cascade="all, delete-orphan"
    )


class WorkflowRunStep(Base):
    __tablename__ = "workflow_run_steps"

    id = Column(Integer, primary_key=True)
    run_id = Column(
        Integer,
        ForeignKey("workflow_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_key = Column(String(128), nullable=False)
    step_type = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    input = Column(JSONB, nullable=True)
    output = Column(JSONB, nullable=True)
    citations = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    token_usage = Column(JSONB, nullable=True)

    run = relationship("WorkflowRun", back_populates="steps")


class WorkflowWebhook(Base, TimestampMixin):
    __tablename__ = "workflow_webhooks"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(
        Integer,
        ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url = Column(String(2048), nullable=False)
    secret = Column(String(255), nullable=True)
    events = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, nullable=False, default=True)

    workflow = relationship("WorkflowDefinition", back_populates="webhooks")


class WorkflowSchedule(Base, TimestampMixin):
    __tablename__ = "workflow_schedules"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(26),
        unique=True,
        nullable=False,
        default=new_uuid,
        index=True,
    )
    workflow_id = Column(
        Integer,
        ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    cron_expression = Column(String(128), nullable=False)
    input_defaults = Column(JSONB, nullable=False, default=dict)
    timezone = Column(String(64), nullable=False, default="UTC")
    is_active = Column(Boolean, nullable=False, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)

    workflow = relationship("WorkflowDefinition", back_populates="schedules")
