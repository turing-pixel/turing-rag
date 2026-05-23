from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.uuid_utils import new_uuid
from app.models.base import Base, TimestampMixin

# Association table for many-to-many relationship between Chat and KnowledgeBase
chat_knowledge_bases = Table(
    "chat_knowledge_bases",
    Base.metadata,
    Column(
        "chat_id",
        Integer,
        ForeignKey("chats.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "knowledge_base_id",
        Integer,
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

class Chat(Base, TimestampMixin):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(26),
        unique=True,
        nullable=False,
        default=new_uuid,
        index=True,
    )
    title = Column(String(255), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    llm_provider = Column(String(50), nullable=True)
    llm_model = Column(String(255), nullable=True)
    llm_config_id = Column(
        Integer, ForeignKey("llm_configs.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    user = relationship("User", back_populates="chats")
    llm_config = relationship("LlmConfig", back_populates="chats")
    knowledge_bases = relationship(
        "KnowledgeBase",
        secondary=chat_knowledge_bases,
        backref="chats"
    )

class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    role = Column(String(50), nullable=False)
    feedback = Column(String(16), nullable=True)
    retrieval = Column(JSONB, nullable=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    chat = relationship("Chat", back_populates="messages")
    sources = relationship(
        "MessageSource",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="MessageSource.rank",
    )


class MessageSource(Base):
    __tablename__ = "message_sources"
    __table_args__ = (
        UniqueConstraint("message_id", "rank", name="uq_message_sources_message_rank"),
    )

    id = Column(Integer, primary_key=True)
    message_id = Column(
        Integer,
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rank = Column(SmallInteger, nullable=False)
    chunk_id = Column(
        String(64),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    kb_uuid = Column(String(26), nullable=False)
    score = Column(Float, nullable=True)
    excerpt = Column(Text, nullable=False)

    message = relationship("Message", back_populates="sources")
    chunk = relationship("DocumentChunk", foreign_keys=[chunk_id])
    document = relationship("Document", foreign_keys=[document_id])