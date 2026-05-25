from typing import Any, List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import WorkflowDefinition, WorkflowRun, WorkflowRunStep
from app.schemas.workflow import (
    WorkflowDefinitionCreate,
    WorkflowDefinitionResponse,
    WorkflowDefinitionUpdate,
    WorkflowDocumentTextResponse,
    WorkflowRunCreate,
    WorkflowRunResponse,
    WorkflowRunStepResponse,
    WorkflowRunSummaryResponse,
    WorkflowScheduleCreate,
    WorkflowScheduleResponse,
    WorkflowTemplateResponse,
    WorkflowWebhookCreate,
    WorkflowWebhookResponse,
)
from app.services.workflow.engine import stream_workflow_run
from app.services.workflow_resolve import (
    require_run_for_user,
    require_schedule_for_user,
    require_workflow_for_user,
)
from app.services.document_processor import extract_workflow_document_text
from app.services.workflow_service import (
    create_schedule,
    create_webhook,
    create_workflow_definition,
    ensure_templates_seeded,
    get_template_by_key,
    list_templates,
    reset_workflow_from_template,
    start_workflow_run,
    update_workflow_definition,
)

router = APIRouter()


def _definition_to_response(
    row: WorkflowDefinition,
    *,
    last_run: WorkflowRun | None = None,
) -> WorkflowDefinitionResponse:
    return WorkflowDefinitionResponse(
        uuid=row.uuid,
        template_key=row.template_key,
        name=row.name,
        description=row.description,
        config=row.config or {},
        resolved_steps=row.resolved_steps or [],
        graph=row.graph,
        llm_config_id=row.llm_config_id,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        last_run_status=last_run.status if last_run else None,
        last_run_at=last_run.created_at if last_run else None,
    )


def _run_to_response(
    run: WorkflowRun,
    workflow: WorkflowDefinition,
    steps: List[WorkflowRunStep],
) -> WorkflowRunResponse:
    return WorkflowRunResponse(
        uuid=run.uuid,
        workflow_uuid=workflow.uuid,
        status=run.status,
        input=run.input or {},
        output=run.output,
        error_message=run.error_message,
        template_key=run.template_key,
        created_at=run.created_at,
        updated_at=run.updated_at,
        steps=[
            WorkflowRunStepResponse(
                step_key=s.step_key,
                step_type=s.step_type,
                status=s.status,
                input=s.input,
                output=s.output,
                citations=s.citations,
                error_message=s.error_message,
                started_at=s.started_at,
                finished_at=s.finished_at,
                duration_ms=s.duration_ms,
            )
            for s in steps
        ],
    )


@router.post(
    "/workflows/extract-document-text",
    response_model=WorkflowDocumentTextResponse,
)
async def extract_workflow_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> WorkflowDocumentTextResponse:
    del current_user  # auth gate only
    try:
        result = await extract_workflow_document_text(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to parse document") from exc
    return WorkflowDocumentTextResponse(**result)


@router.get("/workflow-templates", response_model=List[WorkflowTemplateResponse])
def list_workflow_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    ensure_templates_seeded(db)
    return list_templates(db)


@router.get("/workflow-templates/{template_key}", response_model=WorkflowTemplateResponse)
def get_workflow_template(
    template_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    ensure_templates_seeded(db)
    tpl = get_template_by_key(db, template_key)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.get("/workflows", response_model=List[WorkflowDefinitionResponse])
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    rows = (
        db.query(WorkflowDefinition)
        .filter(WorkflowDefinition.user_id == current_user.id)
        .order_by(WorkflowDefinition.updated_at.desc())
        .all()
    )
    out: list[WorkflowDefinitionResponse] = []
    for row in rows:
        last_run = (
            db.query(WorkflowRun)
            .filter(WorkflowRun.workflow_id == row.id)
            .order_by(WorkflowRun.created_at.desc())
            .first()
        )
        out.append(_definition_to_response(row, last_run=last_run))
    return out


@router.post("/workflows", response_model=WorkflowDefinitionResponse)
def create_workflow(
    body: WorkflowDefinitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    ensure_templates_seeded(db)
    try:
        row = create_workflow_definition(
            db,
            current_user.id,
            template_key=body.template_key,
            name=body.name,
            description=body.description,
            config=body.config,
            step_overrides=body.step_overrides,
            graph=body.graph,
            llm_config_id=body.llm_config_id,
        )
        if body.resolved_steps is not None:
            row.resolved_steps = body.resolved_steps
            db.commit()
            db.refresh(row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _definition_to_response(row)


@router.get("/workflows/{workflow_uuid}", response_model=WorkflowDefinitionResponse)
def get_workflow(
    workflow_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    row = require_workflow_for_user(db, workflow_uuid, current_user.id)
    last_run = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == row.id)
        .order_by(WorkflowRun.created_at.desc())
        .first()
    )
    return _definition_to_response(row, last_run=last_run)


@router.patch("/workflows/{workflow_uuid}", response_model=WorkflowDefinitionResponse)
def patch_workflow(
    workflow_uuid: str,
    body: WorkflowDefinitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    row = require_workflow_for_user(db, workflow_uuid, current_user.id)
    fields_set = body.model_fields_set
    try:
        row = update_workflow_definition(
            db,
            row,
            name=body.name,
            description=body.description,
            config=body.config,
            step_overrides=body.step_overrides,
            resolved_steps=body.resolved_steps,
            graph=body.graph,
            llm_config_id=body.llm_config_id,
            clear_llm_config_id=(
                "llm_config_id" in fields_set and body.llm_config_id is None
            ),
            is_active=body.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _definition_to_response(row)


@router.post(
    "/workflows/{workflow_uuid}/reset-template",
    response_model=WorkflowDefinitionResponse,
)
def reset_workflow_template(
    workflow_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    row = require_workflow_for_user(db, workflow_uuid, current_user.id)
    try:
        row = reset_workflow_from_template(db, row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _definition_to_response(row)


@router.delete("/workflows/{workflow_uuid}", status_code=204)
def delete_workflow(
    workflow_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    row = require_workflow_for_user(db, workflow_uuid, current_user.id)
    db.delete(row)
    db.commit()


@router.post("/workflows/{workflow_uuid}/runs", response_model=WorkflowRunResponse)
async def create_workflow_run(
    workflow_uuid: str,
    body: WorkflowRunCreate,
    stream: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    workflow = require_workflow_for_user(db, workflow_uuid, current_user.id)
    if stream:
        run = WorkflowRun(
            workflow_id=workflow.id,
            user_id=current_user.id,
            status="pending",
            input=body.input,
            template_key=workflow.template_key,
            definition_snapshot={},
        )
        from app.services.workflow_service import build_definition_snapshot

        run.definition_snapshot = build_definition_snapshot(workflow)
        db.add(run)
        db.commit()
        db.refresh(run)

        return StreamingResponse(
            stream_workflow_run(db, workflow, run),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        run = await start_workflow_run(db, workflow, current_user.id, body.input)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    steps = (
        db.query(WorkflowRunStep)
        .filter(WorkflowRunStep.run_id == run.id)
        .order_by(WorkflowRunStep.id.asc())
        .all()
    )
    return _run_to_response(run, workflow, steps)


@router.get(
    "/workflows/{workflow_uuid}/runs",
    response_model=List[WorkflowRunSummaryResponse],
)
def list_workflow_runs(
    workflow_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    workflow = require_workflow_for_user(db, workflow_uuid, current_user.id)
    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow.id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        WorkflowRunSummaryResponse(
            uuid=r.uuid,
            status=r.status,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in runs
    ]


@router.get("/workflow-runs/{run_uuid}", response_model=WorkflowRunResponse)
def get_workflow_run(
    run_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    run = require_run_for_user(db, run_uuid, current_user.id)
    workflow = (
        db.query(WorkflowDefinition)
        .filter(
            WorkflowDefinition.id == run.workflow_id,
            WorkflowDefinition.user_id == current_user.id,
        )
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    steps = (
        db.query(WorkflowRunStep)
        .filter(WorkflowRunStep.run_id == run.id)
        .order_by(WorkflowRunStep.id.asc())
        .all()
    )
    return _run_to_response(run, workflow, steps)


@router.post(
    "/workflows/{workflow_uuid}/webhooks",
    response_model=WorkflowWebhookResponse,
)
def add_workflow_webhook(
    workflow_uuid: str,
    body: WorkflowWebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    workflow = require_workflow_for_user(db, workflow_uuid, current_user.id)
    hook = create_webhook(
        db,
        workflow.id,
        url=body.url,
        events=body.events,
        secret=body.secret,
    )
    return hook


@router.get(
    "/workflows/{workflow_uuid}/webhooks",
    response_model=List[WorkflowWebhookResponse],
)
def list_workflow_webhooks(
    workflow_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    workflow = require_workflow_for_user(db, workflow_uuid, current_user.id)
    return workflow.webhooks


@router.get(
    "/workflows/{workflow_uuid}/schedules",
    response_model=List[WorkflowScheduleResponse],
)
def list_workflow_schedules(
    workflow_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    workflow = require_workflow_for_user(db, workflow_uuid, current_user.id)
    return [
        WorkflowScheduleResponse(
            uuid=s.uuid,
            name=s.name,
            cron_expression=s.cron_expression,
            input_defaults=s.input_defaults or {},
            timezone=s.timezone,
            is_active=s.is_active,
            last_run_at=s.last_run_at,
            next_run_at=s.next_run_at,
        )
        for s in workflow.schedules
    ]


@router.post(
    "/workflows/{workflow_uuid}/schedules",
    response_model=WorkflowScheduleResponse,
)
def add_workflow_schedule(
    workflow_uuid: str,
    body: WorkflowScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    workflow = require_workflow_for_user(db, workflow_uuid, current_user.id)
    schedule = create_schedule(
        db,
        workflow.id,
        name=body.name,
        cron_expression=body.cron_expression,
        input_defaults=body.input_defaults,
        timezone=body.timezone,
    )
    return WorkflowScheduleResponse(
        uuid=schedule.uuid,
        name=schedule.name,
        cron_expression=schedule.cron_expression,
        input_defaults=schedule.input_defaults or {},
        timezone=schedule.timezone,
        is_active=schedule.is_active,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
    )


@router.post("/workflow-schedules/{schedule_uuid}/trigger", response_model=WorkflowRunResponse)
async def trigger_schedule(
    schedule_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    schedule = require_schedule_for_user(db, schedule_uuid, current_user.id)
    workflow = schedule.workflow
    try:
        run = await start_workflow_run(
            db, workflow, current_user.id, schedule.input_defaults or {}
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    steps = (
        db.query(WorkflowRunStep)
        .filter(WorkflowRunStep.run_id == run.id)
        .order_by(WorkflowRunStep.id.asc())
        .all()
    )
    return _run_to_response(run, workflow, steps)
