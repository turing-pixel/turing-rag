"""Workflow definition and run orchestration."""

from __future__ import annotations

import copy
from typing import Any

from sqlalchemy.orm import Session

from app.models.workflow import (
    WorkflowDefinition,
    WorkflowRun,
    WorkflowSchedule,
    WorkflowTemplate,
    WorkflowWebhook,
)
from app.services.workflow.engine import run_workflow
from app.services.workflow.templates.registry import get_system_template, list_system_templates


def merge_steps_with_overrides(
    base_steps: list[dict[str, Any]],
    overrides: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if not overrides:
        return copy.deepcopy(base_steps)
    by_key = {s["key"]: copy.deepcopy(s) for s in base_steps if s.get("key")}
    for item in overrides:
        key = item.get("key")
        if not key:
            continue
        if key in by_key:
            by_key[key].update(item)
        else:
            by_key[key] = copy.deepcopy(item)
    order = [s["key"] for s in base_steps if s.get("key")]
    extra = [k for k in by_key if k not in order]
    return [by_key[k] for k in order + extra]


def build_definition_snapshot(workflow: WorkflowDefinition) -> dict[str, Any]:
    return {
        "uuid": workflow.uuid,
        "template_key": workflow.template_key,
        "name": workflow.name,
        "config": workflow.config,
        "resolved_steps": workflow.resolved_steps,
        "graph": workflow.graph,
        "llm_config_id": workflow.llm_config_id,
    }


def list_templates(db: Session) -> list[WorkflowTemplate]:
    rows = db.query(WorkflowTemplate).order_by(WorkflowTemplate.id.asc()).all()
    if rows:
        return rows
    return []


def get_template_by_key(db: Session, key: str) -> WorkflowTemplate | None:
    return db.query(WorkflowTemplate).filter(WorkflowTemplate.key == key).first()


def create_workflow_definition(
    db: Session,
    user_id: int,
    *,
    template_key: str,
    name: str,
    description: str | None = None,
    config: dict[str, Any] | None = None,
    step_overrides: list[dict[str, Any]] | None = None,
    graph: dict[str, Any] | None = None,
    llm_config_id: int | None = None,
) -> WorkflowDefinition:
    tpl_row = get_template_by_key(db, template_key)
    tpl_dict = get_system_template(template_key)
    if not tpl_dict and not tpl_row:
        raise ValueError(f"Unknown workflow template: {template_key}")

    base_steps = (
        (tpl_row.step_schema if tpl_row else None)
        or (tpl_dict.get("steps") if tpl_dict else None)
        or []
    )
    resolved = merge_steps_with_overrides(base_steps, step_overrides)
    default_graph = (tpl_row.default_graph if tpl_row else None) or (
        tpl_dict.get("default_graph") if tpl_dict else None
    )

    workflow = WorkflowDefinition(
        user_id=user_id,
        template_id=tpl_row.id if tpl_row else None,
        template_key=template_key,
        name=name,
        description=description,
        config=config or {},
        resolved_steps=resolved,
        graph=graph or default_graph,
        llm_config_id=llm_config_id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


def update_workflow_definition(
    db: Session,
    workflow: WorkflowDefinition,
    *,
    name: str | None = None,
    description: str | None = None,
    config: dict[str, Any] | None = None,
    step_overrides: list[dict[str, Any]] | None = None,
    resolved_steps: list[dict[str, Any]] | None = None,
    graph: dict[str, Any] | None = None,
    llm_config_id: int | None = None,
    clear_llm_config_id: bool = False,
    is_active: bool | None = None,
) -> WorkflowDefinition:
    if name is not None:
        workflow.name = name
    if description is not None:
        workflow.description = description
    if config is not None:
        workflow.config = config
    if graph is not None:
        workflow.graph = graph
    if clear_llm_config_id:
        workflow.llm_config_id = None
    elif llm_config_id is not None:
        workflow.llm_config_id = llm_config_id
    if is_active is not None:
        workflow.is_active = is_active
    if resolved_steps is not None:
        workflow.resolved_steps = resolved_steps
    elif step_overrides is not None:
        tpl = get_template_by_key(db, workflow.template_key)
        base = (tpl.step_schema if tpl else None) or (
            get_system_template(workflow.template_key) or {}
        ).get("steps", [])
        workflow.resolved_steps = merge_steps_with_overrides(base, step_overrides)
    db.commit()
    db.refresh(workflow)
    return workflow


async def start_workflow_run(
    db: Session,
    workflow: WorkflowDefinition,
    user_id: int,
    run_input: dict[str, Any],
) -> WorkflowRun:
    if not workflow.is_active:
        raise ValueError("Workflow is inactive")

    run = WorkflowRun(
        workflow_id=workflow.id,
        user_id=user_id,
        status="pending",
        input=run_input,
        template_key=workflow.template_key,
        definition_snapshot=build_definition_snapshot(workflow),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    await run_workflow(db, workflow, run)
    db.refresh(run)
    return run


def create_webhook(
    db: Session,
    workflow_id: int,
    *,
    url: str,
    events: list[str],
    secret: str | None = None,
) -> WorkflowWebhook:
    hook = WorkflowWebhook(
        workflow_id=workflow_id,
        url=url,
        events=events,
        secret=secret,
    )
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return hook


def create_schedule(
    db: Session,
    workflow_id: int,
    *,
    name: str,
    cron_expression: str,
    input_defaults: dict[str, Any] | None = None,
    timezone: str = "UTC",
) -> WorkflowSchedule:
    schedule = WorkflowSchedule(
        workflow_id=workflow_id,
        name=name,
        cron_expression=cron_expression,
        input_defaults=input_defaults or {},
        timezone=timezone,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


def reset_workflow_from_template(
    db: Session, workflow: WorkflowDefinition
) -> WorkflowDefinition:
    """Replace resolved_steps/graph with the latest system template definition."""
    tpl_row = get_template_by_key(db, workflow.template_key)
    tpl_dict = get_system_template(workflow.template_key)
    if not tpl_row and not tpl_dict:
        raise ValueError(f"Unknown workflow template: {workflow.template_key}")

    steps = (tpl_row.step_schema if tpl_row else None) or (
        tpl_dict.get("steps") if tpl_dict else []
    )
    graph = (tpl_row.default_graph if tpl_row else None) or (
        tpl_dict.get("default_graph") if tpl_dict else None
    )
    workflow.resolved_steps = copy.deepcopy(steps)
    workflow.graph = copy.deepcopy(graph) if graph else None
    if tpl_row:
        workflow.template_id = tpl_row.id
    db.commit()
    db.refresh(workflow)
    return workflow


def ensure_templates_seeded(db: Session) -> None:
    """Idempotent seed / sync system templates from code registry."""
    registry = {tpl["key"]: tpl for tpl in list_system_templates()}
    existing = db.query(WorkflowTemplate).all()
    by_key = {row.key: row for row in existing}

    if not existing:
        for tpl in list_system_templates():
            db.add(
                WorkflowTemplate(
                    key=tpl["key"],
                    name=tpl["name"],
                    description=tpl.get("description"),
                    category=tpl.get("category", "general"),
                    input_schema=tpl.get("input_schema") or {},
                    step_schema=tpl.get("steps") or [],
                    output_schema=tpl.get("output_schema"),
                    default_graph=tpl.get("default_graph"),
                    is_system=True,
                )
            )
        db.commit()
        return

    updated = False
    for key, tpl in registry.items():
        row = by_key.get(key)
        if not row:
            db.add(
                WorkflowTemplate(
                    key=key,
                    name=tpl["name"],
                    description=tpl.get("description"),
                    category=tpl.get("category", "general"),
                    input_schema=tpl.get("input_schema") or {},
                    step_schema=tpl.get("steps") or [],
                    output_schema=tpl.get("output_schema"),
                    default_graph=tpl.get("default_graph"),
                    is_system=True,
                )
            )
            updated = True
            continue
        if not row.is_system:
            continue
        row.name = tpl["name"]
        row.description = tpl.get("description")
        row.category = tpl.get("category", "general")
        row.input_schema = tpl.get("input_schema") or {}
        row.step_schema = tpl.get("steps") or []
        row.output_schema = tpl.get("output_schema")
        row.default_graph = tpl.get("default_graph")
        updated = True
    if updated:
        db.commit()
