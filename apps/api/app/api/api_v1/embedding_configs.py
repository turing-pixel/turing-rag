from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.embedding_config import (
    EmbeddingConfigCreate,
    EmbeddingConfigResponse,
    EmbeddingConfigUpdate,
    EmbeddingEnvDefaultResponse,
    EmbeddingFetchModelsResponse,
    EmbeddingModelOptionResponse,
    EmbeddingProbeRequest,
    EmbeddingProviderMetaListResponse,
    EmbeddingProviderMetaResponse,
    EmbeddingVerifyResponse,
)
from app.services.embedding.embedding_config_service import (
    create_embedding_config,
    delete_embedding_config,
    get_env_default_embedding_config,
    get_embedding_config,
    get_provider_metadata,
    list_embedding_configs,
    set_env_default_embedding_config,
    to_response,
    update_embedding_config,
)
from app.services.embedding.embedding_probe_service import (
    fetch_available_models,
    verify_embedding_connection,
)

router = APIRouter()


@router.get("/providers", response_model=EmbeddingProviderMetaListResponse)
def list_provider_metadata(
    current_user: User = Depends(get_current_user),
) -> Any:
    return EmbeddingProviderMetaListResponse(
        providers=[
            EmbeddingProviderMetaResponse(**item) for item in get_provider_metadata()
        ]
    )


@router.post("/fetch-models", response_model=EmbeddingFetchModelsResponse)
def fetch_models_endpoint(
    *,
    db: Session = Depends(get_db),
    body: EmbeddingProbeRequest,
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

    return EmbeddingFetchModelsResponse(
        models=[
            EmbeddingModelOptionResponse(id=item.id, label=item.label) for item in models
        ],
        source=source,
    )


@router.post("/verify", response_model=EmbeddingVerifyResponse)
def verify_model_endpoint(
    *,
    db: Session = Depends(get_db),
    body: EmbeddingProbeRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    if not (body.model or "").strip():
        raise HTTPException(status_code=400, detail="Model ID is required")

    try:
        success, message = verify_embedding_connection(
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

    return EmbeddingVerifyResponse(success=success, message=message)


@router.get("/env-default", response_model=EmbeddingEnvDefaultResponse)
def read_env_default_embedding_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return EmbeddingEnvDefaultResponse(
        **get_env_default_embedding_config(db, current_user.id)
    )


@router.post("/env-default/set-default", response_model=EmbeddingEnvDefaultResponse)
def set_env_default_embedding_config_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        set_env_default_embedding_config(db, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return EmbeddingEnvDefaultResponse(
        **get_env_default_embedding_config(db, current_user.id)
    )


@router.get("", response_model=List[EmbeddingConfigResponse])
def read_embedding_configs(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
) -> Any:
    configs = list_embedding_configs(db, user_id=current_user.id, skip=skip, limit=limit)
    return [EmbeddingConfigResponse(**to_response(config, db)) for config in configs]


@router.get("/{config_id}", response_model=EmbeddingConfigResponse)
def read_embedding_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    config = get_embedding_config(db, config_id, user_id=current_user.id)
    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")
    return EmbeddingConfigResponse(**to_response(config, db))


@router.post("", response_model=EmbeddingConfigResponse)
def create_embedding_config_endpoint(
    *,
    db: Session = Depends(get_db),
    config_in: EmbeddingConfigCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        config = create_embedding_config(db, user_id=current_user.id, data=config_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return EmbeddingConfigResponse(**to_response(config, db))


@router.put("/{config_id}", response_model=EmbeddingConfigResponse)
def update_embedding_config_endpoint(
    *,
    db: Session = Depends(get_db),
    config_id: int,
    config_in: EmbeddingConfigUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    config = get_embedding_config(db, config_id, user_id=current_user.id)
    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")
    try:
        config = update_embedding_config(db, config=config, data=config_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return EmbeddingConfigResponse(**to_response(config, db))


@router.delete("/{config_id}", response_model=EmbeddingConfigResponse)
def delete_embedding_config_endpoint(
    *,
    db: Session = Depends(get_db),
    config_id: int,
    current_user: User = Depends(get_current_user),
) -> Any:
    config = get_embedding_config(db, config_id, user_id=current_user.id)
    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")
    response = EmbeddingConfigResponse(**to_response(config, db))
    delete_embedding_config(db, config)
    return response
