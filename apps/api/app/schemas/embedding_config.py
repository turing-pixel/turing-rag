from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.services.embedding.embedding_provider_registry import (
    SUPPORTED_EMBEDDING_PROVIDERS,
)


class EmbeddingConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider: str
    model: str = Field(..., min_length=1, max_length=255)
    api_base: Optional[str] = Field(default=None, max_length=512)
    is_active: bool = True
    is_default: bool = False

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        normalized = value.lower().strip()
        if normalized not in SUPPORTED_EMBEDDING_PROVIDERS:
            raise ValueError(
                "Unsupported provider. Must be one of: "
                + ", ".join(SUPPORTED_EMBEDDING_PROVIDERS)
            )
        return normalized


class EmbeddingConfigCreate(EmbeddingConfigBase):
    api_key: Optional[str] = None


class EmbeddingConfigUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    provider: Optional[str] = None
    model: Optional[str] = Field(default=None, min_length=1, max_length=255)
    api_base: Optional[str] = Field(default=None, max_length=512)
    api_key: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.lower().strip()
        if normalized not in SUPPORTED_EMBEDDING_PROVIDERS:
            raise ValueError(
                "Unsupported provider. Must be one of: "
                + ", ".join(SUPPORTED_EMBEDDING_PROVIDERS)
            )
        return normalized


class EmbeddingConfigResponse(EmbeddingConfigBase):
    id: int
    user_id: int
    api_key_masked: str = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmbeddingProviderMetaResponse(BaseModel):
    provider: str
    label: str
    default_api_base: str
    default_model: str
    requires_api_key: bool


class EmbeddingProviderMetaListResponse(BaseModel):
    providers: List[EmbeddingProviderMetaResponse]


class EmbeddingProbeRequest(BaseModel):
    provider: str
    api_base: Optional[str] = Field(default=None, max_length=512)
    api_key: Optional[str] = None
    model: Optional[str] = Field(default=None, max_length=255)
    config_id: Optional[int] = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        normalized = value.lower().strip()
        if normalized not in SUPPORTED_EMBEDDING_PROVIDERS:
            raise ValueError(
                "Unsupported provider. Must be one of: "
                + ", ".join(SUPPORTED_EMBEDDING_PROVIDERS)
            )
        return normalized


class EmbeddingModelOptionResponse(BaseModel):
    id: str
    label: str


class EmbeddingFetchModelsResponse(BaseModel):
    models: List[EmbeddingModelOptionResponse]
    source: str


class EmbeddingVerifyResponse(BaseModel):
    success: bool
    message: str


class EmbeddingEnvDefaultResponse(BaseModel):
    configured: bool
    is_default: bool = False
    provider: Optional[str] = None
    model: Optional[str] = None
    api_base: Optional[str] = None
    api_key_masked: str = ""
