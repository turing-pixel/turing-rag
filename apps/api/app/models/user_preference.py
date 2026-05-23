from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin

DEFAULT_SOURCE_ENV = "env"
DEFAULT_SOURCE_CONFIG = "config"


class UserPreference(Base, TimestampMixin):
    """Per-user defaults for chat LLM and embedding (env vs a specific DB config)."""

    __tablename__ = "user_preferences"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    default_llm_source = Column(String(20), nullable=False, default=DEFAULT_SOURCE_ENV)
    default_llm_config_id = Column(
        Integer, ForeignKey("llm_configs.id", ondelete="SET NULL"), nullable=True
    )
    default_embedding_source = Column(String(20), nullable=False, default=DEFAULT_SOURCE_ENV)
    default_embedding_config_id = Column(
        Integer, ForeignKey("embedding_configs.id", ondelete="SET NULL"), nullable=True
    )

    user = relationship("User", back_populates="preferences")
    default_llm_config = relationship(
        "LlmConfig",
        foreign_keys=[default_llm_config_id],
    )
    default_embedding_config = relationship(
        "EmbeddingConfig",
        foreign_keys=[default_embedding_config_id],
    )
