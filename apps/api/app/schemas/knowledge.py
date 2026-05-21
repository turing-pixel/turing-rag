from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from app.constants.kb_icons import DEFAULT_KB_ICON, normalize_kb_icon
from app.constants.kb_icon_colors import DEFAULT_KB_ICON_COLOR, normalize_kb_icon_color

class KnowledgeBaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = Field(default=DEFAULT_KB_ICON, max_length=64)
    icon_color: Optional[str] = Field(default=DEFAULT_KB_ICON_COLOR, max_length=32)

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, value: Optional[str]) -> str:
        return normalize_kb_icon(value)

    @field_validator("icon_color")
    @classmethod
    def validate_icon_color(cls, value: Optional[str]) -> str:
        return normalize_kb_icon_color(value)

class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass

class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=64)
    icon_color: Optional[str] = Field(default=None, max_length=32)

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return normalize_kb_icon(value)

    @field_validator("icon_color")
    @classmethod
    def validate_icon_color(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return normalize_kb_icon_color(value)

class DocumentBase(BaseModel):
    file_name: str
    file_path: str
    file_hash: str
    file_size: int
    content_type: str

class DocumentCreate(DocumentBase):
    knowledge_base_id: int

class DocumentUploadBase(BaseModel):
    file_name: str
    file_hash: str
    file_size: int
    content_type: str
    temp_path: str
    status: str = "pending"
    error_message: Optional[str] = None

class DocumentUploadCreate(DocumentUploadBase):
    knowledge_base_id: int

class DocumentUploadResponse(DocumentUploadBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProcessingTaskBase(BaseModel):
    status: str
    progress: int = 0
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

class ProcessingTaskCreate(ProcessingTaskBase):
    document_id: int
    knowledge_base_id: int

class ProcessingTask(ProcessingTaskBase):
    id: int
    document_id: int
    knowledge_base_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(DocumentBase):
    id: int
    knowledge_base_id: int
    created_at: datetime
    updated_at: datetime
    processing_tasks: List[ProcessingTask] = []

    class Config:
        from_attributes = True

class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    documents: List[DocumentResponse] = []

    class Config:
        from_attributes = True

class PreviewRequest(BaseModel):
    document_ids: List[int]
    chunk_size: int = 1000
    chunk_overlap: int = 200 