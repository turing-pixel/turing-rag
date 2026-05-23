"""Map document ORM rows to API schemas (external knowledge_base_uuid)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.schemas.knowledge import (
    DocumentDetailResponse,
    DocumentResponse,
    ProcessingTask,
)

if TYPE_CHECKING:
    from app.models.knowledge import Document, ProcessingTask as ProcessingTaskModel


def processing_task_to_response(
    task: "ProcessingTaskModel", kb_uuid: str
) -> ProcessingTask:
    return ProcessingTask(
        id=task.id,
        document_id=task.document_id,
        knowledge_base_uuid=kb_uuid,
        status=task.status,
        progress=task.progress,
        progress_message=task.progress_message,
        error_message=task.error_message,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def document_to_response(doc: "Document", kb_uuid: str) -> DocumentResponse:
    tasks = getattr(doc, "processing_tasks", None) or []
    return DocumentResponse(
        id=doc.id,
        file_name=doc.file_name,
        file_path=doc.file_path,
        file_hash=doc.file_hash,
        file_size=doc.file_size,
        content_type=doc.content_type,
        knowledge_base_uuid=kb_uuid,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        processing_tasks=[
            processing_task_to_response(task, kb_uuid) for task in tasks
        ],
    )


def document_to_detail_response(
    doc: "Document", kb_uuid: str, *, chunk_count: int = 0
) -> DocumentDetailResponse:
    base = document_to_response(doc, kb_uuid)
    return DocumentDetailResponse(
        **base.model_dump(),
        chunk_count=chunk_count,
    )
