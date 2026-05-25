"""Workflow execution engine (linear steps + optional graph)."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict, deque
from datetime import datetime
from typing import Any, AsyncGenerator, Callable, Awaitable

import httpx
from sqlalchemy.orm import Session

from app.models.workflow import (
    WorkflowDefinition,
    WorkflowRun,
    WorkflowRunStep,
    WorkflowWebhook,
)
from app.services.llm.llm_models import resolve_chat_llm_runtime
from app.services.workflow.steps import execute_step

logger = logging.getLogger(__name__)


def _ordered_steps_from_graph(graph: dict[str, Any] | None) -> list[dict[str, Any]] | None:
    if not graph:
        return None
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        return None

    node_by_id = {n["id"]: n for n in nodes if n.get("id")}
    adj: dict[str, list[str]] = defaultdict(list)
    indegree: dict[str, int] = {nid: 0 for nid in node_by_id}

    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if src in node_by_id and tgt in node_by_id:
            adj[src].append(tgt)
            indegree[tgt] = indegree.get(tgt, 0) + 1

    queue = deque([nid for nid, deg in indegree.items() if deg == 0])
    ordered_ids: list[str] = []
    while queue:
        nid = queue.popleft()
        ordered_ids.append(nid)
        for nxt in adj.get(nid, []):
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)

    if len(ordered_ids) != len(node_by_id):
        return None

    steps_map = graph.get("stepDefinitions") or {}
    result: list[dict[str, Any]] = []
    for nid in ordered_ids:
        node = node_by_id[nid]
        step_def = steps_map.get(nid) or node.get("data", {}).get("step") or {}
        step = dict(step_def)
        step.setdefault("key", nid)
        step.setdefault("type", node.get("type") or step.get("type"))
        result.append(step)
    return result


def resolve_execution_steps(
    resolved_steps: list[dict[str, Any]],
    graph: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    graph_steps = _ordered_steps_from_graph(graph)
    if graph_steps:
        return graph_steps
    return resolved_steps


async def _dispatch_webhooks(
    db: Session,
    workflow_id: int,
    event: str,
    payload: dict[str, Any],
) -> None:
    hooks = (
        db.query(WorkflowWebhook)
        .filter(
            WorkflowWebhook.workflow_id == workflow_id,
            WorkflowWebhook.is_active.is_(True),
        )
        .all()
    )
    for hook in hooks:
        events = hook.events or []
        if event not in events and "*" not in events:
            continue
        try:
            headers = {"Content-Type": "application/json"}
            if hook.secret:
                headers["X-Workflow-Secret"] = hook.secret
            async with httpx.AsyncClient(timeout=15.0) as client:
                await client.post(hook.url, json=payload, headers=headers)
        except Exception as exc:
            logger.warning("Webhook delivery failed url=%s: %s", hook.url, exc)


def _create_run_step(
    db: Session,
    run_id: int,
    step: dict[str, Any],
) -> WorkflowRunStep:
    row = WorkflowRunStep(
        run_id=run_id,
        step_key=step.get("key", "unknown"),
        step_type=step.get("type", "unknown"),
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    return row


async def run_workflow(
    db: Session,
    workflow: WorkflowDefinition,
    run: WorkflowRun,
    *,
    on_step_event: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> WorkflowRun:
    config = workflow.config or {}
    kb_uuids = config.get("knowledge_base_uuids") or []
    run_input = run.input or {}

    try:
        llm_runtime = resolve_chat_llm_runtime(
            db,
            workflow.user_id,
            llm_config_id=workflow.llm_config_id or config.get("llm_config_id"),
        )
    except ValueError as exc:
        run.status = "failed"
        run.error_message = str(exc)
        db.commit()
        return run

    steps = resolve_execution_steps(
        workflow.resolved_steps or [],
        workflow.graph,
    )

    run.status = "running"
    db.commit()

    context_outputs: dict[str, Any] = {}
    final_output: dict[str, Any] | None = None

    async def emit(event: dict[str, Any]) -> None:
        if on_step_event:
            await on_step_event(event)

    await emit({"type": "run_start", "run_uuid": run.uuid, "status": "running"})

    for step in steps:
        step_key = step.get("key", "unknown")
        row = _create_run_step(db, run.id, step)
        await emit({"type": "step_start", "step_key": step_key, "step_type": step.get("type")})

        try:
            row.input = {"step": step, "context_keys": list(context_outputs.keys())}
            result = await execute_step(
                db,
                workflow.user_id,
                step,
                run_input,
                context_outputs,
                knowledge_base_uuids=kb_uuids,
                config=config,
                llm_runtime=llm_runtime,
            )
            context_outputs[step_key] = result
            row.output = result
            row.citations = result.get("citations") if isinstance(result, dict) else None
            row.status = "completed"
            row.finished_at = datetime.utcnow()
            if row.started_at:
                row.duration_ms = int(
                    (row.finished_at - row.started_at).total_seconds() * 1000
                )

            if step.get("type") == "condition" and result.get("halt"):
                run.status = "completed"
                run.output = {
                    "format": "markdown",
                    "text": result.get("message") or "Workflow halted by condition.",
                    "halted": True,
                }
                db.commit()
                await emit(
                    {
                        "type": "step_complete",
                        "step_key": step_key,
                        "status": "completed",
                        "halted": True,
                    }
                )
                await emit({"type": "run_complete", "status": run.status, "output": run.output})
                await _dispatch_webhooks(
                    db,
                    workflow.id,
                    "run.completed",
                    {"run_uuid": run.uuid, "status": run.status, "output": run.output},
                )
                return run

            if step.get("type") == "format":
                final_output = result

            await emit(
                {
                    "type": "step_complete",
                    "step_key": step_key,
                    "status": "completed",
                    "output": result,
                }
            )
        except Exception as exc:
            row.status = "failed"
            row.error_message = str(exc)
            row.finished_at = datetime.utcnow()
            run.status = "failed"
            run.error_message = str(exc)
            db.commit()
            await emit(
                {
                    "type": "step_failed",
                    "step_key": step_key,
                    "error": str(exc),
                }
            )
            await _dispatch_webhooks(
                db,
                workflow.id,
                "run.failed",
                {"run_uuid": run.uuid, "status": "failed", "error": str(exc)},
            )
            return run
        finally:
            db.commit()

    if final_output is None:
        last_key = steps[-1]["key"] if steps else None
        last = context_outputs.get(last_key) if last_key else {}
        if isinstance(last, dict):
            final_output = {"format": "text", "text": last.get("text", json.dumps(last))}
        else:
            final_output = {"format": "text", "text": str(last)}

    run.status = "completed"
    run.output = final_output
    db.commit()

    await emit(
        {
            "type": "run_complete",
            "run_uuid": run.uuid,
            "status": "completed",
            "output": final_output,
        }
    )
    await _dispatch_webhooks(
        db,
        workflow.id,
        "run.completed",
        {"run_uuid": run.uuid, "status": "completed", "output": final_output},
    )
    return run


async def stream_workflow_run(
    db: Session,
    workflow: WorkflowDefinition,
    run: WorkflowRun,
) -> AsyncGenerator[str, None]:
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def on_event(event: dict[str, Any]) -> None:
        await queue.put(event)

    async def runner() -> None:
        try:
            await run_workflow(db, workflow, run, on_step_event=on_event)
        finally:
            await queue.put(None)

    task = asyncio.create_task(runner())
    try:
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    finally:
        await task
