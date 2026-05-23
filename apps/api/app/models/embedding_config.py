from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class EmbeddingConfig(Base, TimestampMixin):
    __tablename__ = "embedding_configs"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)
    model = Column(String(255), nullable=False)
    api_base = Column(String(512), nullable=True)
    api_key = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="embedding_configs")
