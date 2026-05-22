from pydantic import BaseModel, Field, model_validator
from typing import List, Literal, Optional, Any
from datetime import datetime

MessageFeedback = Literal["like", "dislike"]

class MessageBase(BaseModel):
    content: str
    role: str

class MessageCreate(MessageBase):
    chat_id: str

class MessageResponse(MessageBase):
    id: int
    chat_id: str
    feedback: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    feedback: Optional[MessageFeedback] = None

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

class ChatSummaryResponse(ChatBase):
    """Chat list item without full message history."""

    id: str
    user_id: int
    created_at: datetime
    updated_at: datetime
    knowledge_base_ids: List[int] = Field(default_factory=list)
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    message_count: int = 0
    last_message_role: Optional[str] = None
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    """Send a single new user message; history is loaded from the database."""

    content: str = Field(..., min_length=1)


class ChatResponse(ChatBase):
    id: str
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

