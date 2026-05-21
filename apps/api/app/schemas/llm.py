from typing import List

from pydantic import BaseModel


class LlmModelOptionResponse(BaseModel):
    provider: str
    model: str
    label: str
    is_default: bool = False
    config_id: int | None = None


class LlmProviderOptionResponse(BaseModel):
    provider: str
    label: str
    models: List[LlmModelOptionResponse]


class LlmModelsListResponse(BaseModel):
    providers: List[LlmProviderOptionResponse]
    default_provider: str
    default_model: str
    default_config_id: int | None = None
