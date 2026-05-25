from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class WorkflowTemplateResponse(BaseModel):
    id: int
    key: str
    name: str
    description: Optional[str] = None
    category: str
    input_schema: dict[str, Any]
    step_schema: List[dict[str, Any]]
    output_schema: Optional[dict[str, Any]] = None
    default_graph: Optional[dict[str, Any]] = None
    is_system: bool

    class Config:
        from_attributes = True


class WorkflowDefinitionCreate(BaseModel):
    template_key: str
    name: str
    description: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    step_overrides: Optional[List[dict[str, Any]]] = None
    resolved_steps: Optional[List[dict[str, Any]]] = None
    graph: Optional[dict[str, Any]] = None
    llm_config_id: Optional[int] = None


class WorkflowDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    step_overrides: Optional[List[dict[str, Any]]] = None
    resolved_steps: Optional[List[dict[str, Any]]] = None
    graph: Optional[dict[str, Any]] = None
    llm_config_id: Optional[int] = None
    is_active: Optional[bool] = None


class WorkflowDefinitionResponse(BaseModel):
    uuid: str
    template_key: str
    name: str
    description: Optional[str] = None
    config: dict[str, Any]
    resolved_steps: List[dict[str, Any]]
    graph: Optional[dict[str, Any]] = None
    llm_config_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_run_status: Optional[str] = None
    last_run_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkflowRunCreate(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)


class WorkflowRunStepResponse(BaseModel):
    step_key: str
    step_type: str
    status: str
    input: Optional[dict[str, Any]] = None
    output: Optional[dict[str, Any]] = None
    citations: Optional[List[dict[str, Any]]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_ms: Optional[int] = None

    class Config:
        from_attributes = True


class WorkflowRunResponse(BaseModel):
    uuid: str
    workflow_uuid: str
    status: str
    input: dict[str, Any]
    output: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    template_key: str
    created_at: datetime
    updated_at: datetime
    steps: List[WorkflowRunStepResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class WorkflowRunSummaryResponse(BaseModel):
    uuid: str
    status: str
    created_at: datetime
    updated_at: datetime


class WorkflowWebhookCreate(BaseModel):
    url: str
    events: List[str] = Field(default_factory=lambda: ["run.completed", "run.failed"])
    secret: Optional[str] = None


class WorkflowWebhookResponse(BaseModel):
    id: int
    url: str
    events: List[str]
    is_active: bool

    class Config:
        from_attributes = True


class WorkflowScheduleCreate(BaseModel):
    name: str
    cron_expression: str
    input_defaults: dict[str, Any] = Field(default_factory=dict)
    timezone: str = "UTC"


class WorkflowScheduleResponse(BaseModel):
    uuid: str
    name: str
    cron_expression: str
    input_defaults: dict[str, Any]
    timezone: str
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkflowDocumentTextResponse(BaseModel):
    text: str
    file_name: str
    char_count: int
