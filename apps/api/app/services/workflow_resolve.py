from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.uuid_utils import normalize_uuid
from app.models.workflow import WorkflowDefinition, WorkflowRun, WorkflowSchedule


def require_workflow_for_user(
    db: Session, workflow_uuid: str, user_id: int
) -> WorkflowDefinition:
    parsed = normalize_uuid(workflow_uuid)
    if not parsed:
        raise HTTPException(status_code=404, detail="Workflow not found")
    row = (
        db.query(WorkflowDefinition)
        .filter(WorkflowDefinition.uuid == parsed, WorkflowDefinition.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return row


def require_run_for_user(db: Session, run_uuid: str, user_id: int) -> WorkflowRun:
    parsed = normalize_uuid(run_uuid)
    if not parsed:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    row = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.uuid == parsed, WorkflowRun.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    return row


def require_schedule_for_user(
    db: Session, schedule_uuid: str, user_id: int
) -> WorkflowSchedule:
    parsed = normalize_uuid(schedule_uuid)
    if not parsed:
        raise HTTPException(status_code=404, detail="Schedule not found")
    row = (
        db.query(WorkflowSchedule)
        .join(WorkflowDefinition)
        .filter(
            WorkflowSchedule.uuid == parsed,
            WorkflowDefinition.user_id == user_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return row
