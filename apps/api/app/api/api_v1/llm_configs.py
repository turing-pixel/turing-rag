from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.llm_config import (
    LlmConfigCreate,
    LlmConfigResponse,
    LlmConfigUpdate,
    LlmFetchModelsResponse,
    LlmModelOptionResponse,
    LlmProbeRequest,
    LlmProviderMetaListResponse,
    LlmProviderMetaResponse,
    LlmVerifyResponse,
)
from app.services.llm.llm_config_service import (
    create_llm_config,
    delete_llm_config,
    get_llm_config,
    get_provider_metadata,
    list_llm_configs,
    to_response,
    update_llm_config,
)
from app.services.llm.llm_probe_service import (
    fetch_available_models,
    verify_model_connection,
)

router = APIRouter()


@router.get("/providers", response_model=LlmProviderMetaListResponse)
def list_provider_metadata(
    current_user: User = Depends(get_current_user),
) -> Any:
    return LlmProviderMetaListResponse(
        providers=[LlmProviderMetaResponse(**item) for item in get_provider_metadata()]
    )


@router.post("/fetch-models", response_model=LlmFetchModelsResponse)
def fetch_models_endpoint(
    *,
    db: Session = Depends(get_db),
    body: LlmProbeRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        models, source = fetch_available_models(
            db=db,
            user_id=current_user.id,
            provider=body.provider,
            api_base=body.api_base,
            api_key=body.api_key,
            config_id=body.config_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch models: {exc}",
        ) from exc

    return LlmFetchModelsResponse(
        models=[LlmModelOptionResponse(id=item.id, label=item.label) for item in models],
        source=source,
    )


@router.post("/verify", response_model=LlmVerifyResponse)
def verify_model_endpoint(
    *,
    db: Session = Depends(get_db),
    body: LlmProbeRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    if not (body.model or "").strip():
        raise HTTPException(status_code=400, detail="Model ID is required")

    try:
        success, message = verify_model_connection(
            db=db,
            user_id=current_user.id,
            provider=body.provider,
            model=body.model or "",
            api_base=body.api_base,
            api_key=body.api_key,
            config_id=body.config_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return LlmVerifyResponse(success=success, message=message)


@router.get("", response_model=List[LlmConfigResponse])
def read_llm_configs(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
) -> Any:
    configs = list_llm_configs(db, user_id=current_user.id, skip=skip, limit=limit)
    return [LlmConfigResponse(**to_response(config)) for config in configs]


@router.get("/{config_id}", response_model=LlmConfigResponse)
def read_llm_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    config = get_llm_config(db, config_id, user_id=current_user.id)
    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")
    return LlmConfigResponse(**to_response(config))


@router.post("", response_model=LlmConfigResponse)
def create_llm_config_endpoint(
    *,
    db: Session = Depends(get_db),
    config_in: LlmConfigCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        config = create_llm_config(db, user_id=current_user.id, data=config_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LlmConfigResponse(**to_response(config))


@router.put("/{config_id}", response_model=LlmConfigResponse)
def update_llm_config_endpoint(
    *,
    db: Session = Depends(get_db),
    config_id: int,
    config_in: LlmConfigUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    config = get_llm_config(db, config_id, user_id=current_user.id)
    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")
    try:
        config = update_llm_config(db, config=config, data=config_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LlmConfigResponse(**to_response(config))


@router.delete("/{config_id}", response_model=LlmConfigResponse)
def delete_llm_config_endpoint(
    *,
    db: Session = Depends(get_db),
    config_id: int,
    current_user: User = Depends(get_current_user),
) -> Any:
    config = get_llm_config(db, config_id, user_id=current_user.id)
    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")
    response = LlmConfigResponse(**to_response(config))
    delete_llm_config(db, config)
    return response
