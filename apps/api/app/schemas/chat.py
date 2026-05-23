from pydantic import BaseModel, Field, model_validator
from typing import Any, Dict, List, Literal, Optional
from datetime import datetime

MessageFeedback = Literal["like", "dislike"]


class MessageSourceResponse(BaseModel):
    rank: int
    chunk_id: Optional[str] = None
    document_id: int
    kb_uuid: str
    kb_name: Optional[str] = None
    file_name: str = ""
    score: Optional[float] = None
    excerpt: str
    text: str
    preview: str
    stale: bool = False


class MessageRetrievalResponse(BaseModel):
    user_query: str = ""
    search_query: Optional[str] = None
    rewrite_attempted: bool = False
    knowledge_bases: List[Dict[str, str]] = Field(default_factory=list)
    events: List[Dict[str, Any]] = Field(default_factory=list)
    low_confidence: Optional[bool] = None
    confidence_reason: Optional[str] = None
    score_mode: Optional[str] = None
    score_threshold: Optional[float] = None
    recalled_count: Optional[int] = None
    selected_count: Optional[int] = None
    best_score: Optional[float] = None

class MessageBase(BaseModel):
    content: str
    role: str

class MessageCreate(MessageBase):
    chat_uuid: str

class MessageResponse(MessageBase):
    id: int
    chat_uuid: str
    feedback: Optional[str] = None
    retrieval: Optional[MessageRetrievalResponse] = None
    sources: List[MessageSourceResponse] = Field(default_factory=list)
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
    knowledge_base_uuids: List[str] = Field(default_factory=list)
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

class ChatUpdate(BaseModel):
    title: Optional[str] = None
    knowledge_base_uuids: Optional[List[str]] = None
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

class ChatSummaryResponse(ChatBase):
    """Chat list item without full message history."""

    uuid: str
    created_at: datetime
    updated_at: datetime
    knowledge_base_uuids: List[str] = Field(default_factory=list)
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
    uuid: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    knowledge_base_uuids: List[str] = Field(default_factory=list)
    llm_config_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

    class Config:
        from_attributes = True

