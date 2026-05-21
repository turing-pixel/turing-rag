from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any
from datetime import datetime

class MessageBase(BaseModel):
    content: str
    role: str

class MessageCreate(MessageBase):
    chat_id: int

class MessageResponse(MessageBase):
    id: int
    chat_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatBase(BaseModel):
    title: str

class ChatCreate(ChatBase):
    knowledge_base_ids: List[int]
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

class ChatUpdate(BaseModel):
    title: Optional[str] = None
    knowledge_base_ids: Optional[List[int]] = None
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

class ChatResponse(ChatBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    knowledge_base_ids: List[int] = Field(default_factory=list)
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def populate_relationship_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict) and hasattr(data, "__dict__"):
            knowledge_bases = getattr(data, "knowledge_bases", None) or []
            return {
                "id": data.id,
                "title": data.title,
                "user_id": data.user_id,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
                "messages": getattr(data, "messages", []) or [],
                "knowledge_base_ids": [kb.id for kb in knowledge_bases],
                "llm_config_id": getattr(data, "llm_config_id", None),
                "llm_provider": getattr(data, "llm_provider", None),
                "llm_model": getattr(data, "llm_model", None),
            }
        if isinstance(data, dict) and "knowledge_base_ids" not in data:
            knowledge_bases = data.get("knowledge_bases") or []
            if knowledge_bases:
                data = {
                    **data,
                    "knowledge_base_ids": [
                        kb["id"] if isinstance(kb, dict) else kb.id
                        for kb in knowledge_bases
                    ],
                }
        return data
