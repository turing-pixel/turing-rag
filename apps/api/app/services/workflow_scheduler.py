"""Background scheduler for workflow cron expressions."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from croniter import croniter
from sqlalchemy.orm import Session, joinedload

from app.db.session import SessionLocal
from app.models.workflow import WorkflowDefinition, WorkflowSchedule
from app.services.workflow_service import start_workflow_run

logger = logging.getLogger(__name__)

_SCHEDULER_INTERVAL_SECONDS = 60
_scheduler_task: asyncio.Task | None = None


def _compute_next_run(cron_expression: str, base: datetime | None = None) -> datetime:
    base_time = base or datetime.now(timezone.utc).replace(tzinfo=None)
    itr = croniter(cron_expression, base_time)
    return itr.get_next(datetime)


async def _tick_schedules() -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        schedules = (
            db.query(WorkflowSchedule)
            .options(joinedload(WorkflowSchedule.workflow))
            .filter(WorkflowSchedule.is_active.is_(True))
            .all()
        )
        for schedule in schedules:
            workflow: WorkflowDefinition | None = schedule.workflow
            if not workflow or not workflow.is_active:
                continue

            if schedule.next_run_at is None:
                schedule.next_run_at = _compute_next_run(schedule.cron_expression, now)
                db.commit()
                continue

            if schedule.next_run_at > now:
                continue

            try:
                await start_workflow_run(
                    db,
                    workflow,
                    workflow.user_id,
                    schedule.input_defaults or {},
                )
                schedule.last_run_at = now
                schedule.next_run_at = _compute_next_run(
                    schedule.cron_expression, now
                )
                db.commit()
                logger.info(
                    "Scheduled workflow run workflow_id=%s schedule_id=%s",
                    workflow.id,
                    schedule.id,
                )
            except Exception as exc:
                logger.exception(
                    "Scheduled workflow run failed schedule_id=%s: %s",
                    schedule.id,
                    exc,
                )
                db.rollback()
    finally:
        db.close()


async def _scheduler_loop() -> None:
    while True:
        try:
            await _tick_schedules()
        except Exception:
            logger.exception("Workflow scheduler tick failed")
        await asyncio.sleep(_SCHEDULER_INTERVAL_SECONDS)


def start_workflow_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is not None and not _scheduler_task.done():
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Workflow scheduler started (interval=%ss)", _SCHEDULER_INTERVAL_SECONDS)


def stop_workflow_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is None:
        return
    _scheduler_task.cancel()
    _scheduler_task = None
    logger.info("Workflow scheduler stopped")
