from __future__ import annotations

import json
from dataclasses import dataclass
from typing import List, Optional
from urllib.request import Request, urlopen

from openai import OpenAI
from sqlalchemy.orm import Session

from app.services.embedding.embedding_config_service import (
    default_api_base_for_provider,
    get_embedding_config,
    provider_requires_api_key,
)
from app.services.embedding.embedding_factory import EmbeddingsFactory
from app.services.embedding.embedding_provider_registry import (
    get_embedding_provider_definition,
)
from app.services.embedding.ollama_embedding import OLLAMA_EMBEDDING_MODELS

_EMBEDDING_PREFIXES = (
    "text-embedding",
    "embedding",
    "embed-",
)


@dataclass
class ResolvedCredentials:
    provider: str
    api_base: str
    api_key: Optional[str]


@dataclass
class ModelOption:
    id: str
    label: str


def _normalize_openai_api_base(api_base: str) -> str:
    base = (api_base or "").strip().rstrip("/")
    if not base:
        return base
    if base.endswith("/v1") or "/v1/" in f"{base}/":
        return base
    return f"{base}/v1"


def _is_embedding_model(model_id: str) -> bool:
    mid = model_id.lower()
    if any(mid.startswith(prefix) for prefix in _EMBEDDING_PREFIXES):
        return True
    if mid.endswith("-embed") or "embedding" in mid or "embed" in mid:
        return True
    for name in OLLAMA_EMBEDDING_MODELS:
        if mid.startswith(name):
            return True
    return False


def _catalog_fallback(provider: str) -> List[ModelOption]:
    definition = get_embedding_provider_definition(provider)
    if not definition:
        return []
    models = list(definition.catalog_models)
    if definition.default_model and not any(
        m[0] == definition.default_model for m in models
    ):
        models.insert(0, (definition.default_model, definition.default_model))
    return [ModelOption(id=model_id, label=label) for model_id, label in models]


def resolve_credentials(
    *,
    db: Session,
    user_id: int,
    provider: str,
    api_base: Optional[str],
    api_key: Optional[str],
    config_id: Optional[int] = None,
) -> ResolvedCredentials:
    provider = provider.lower().strip()
    definition = get_embedding_provider_definition(provider)
    if not definition:
        raise ValueError(f"Unsupported embedding provider: {provider}")

    resolved_base = (api_base or "").strip() or default_api_base_for_provider(provider)
    resolved_key: Optional[str] = (api_key or "").strip() or None

    if config_id is not None:
        config = get_embedding_config(db, config_id, user_id=user_id)
        if not config:
            raise ValueError("Embedding configuration not found")
        if not resolved_key:
            resolved_key = config.api_key
        if not (api_base or "").strip():
            resolved_base = config.api_base or resolved_base

    if provider_requires_api_key(provider) and not resolved_key:
        raise ValueError("API key is required for this provider")

    return ResolvedCredentials(
        provider=provider,
        api_base=resolved_base,
        api_key=resolved_key,
    )


def fetch_available_models(
    *,
    db: Session,
    user_id: int,
    provider: str,
    api_base: Optional[str] = None,
    api_key: Optional[str] = None,
    config_id: Optional[int] = None,
) -> tuple[List[ModelOption], str]:
    creds = resolve_credentials(
        db=db,
        user_id=user_id,
        provider=provider,
        api_base=api_base,
        api_key=api_key,
        config_id=config_id,
    )

    if creds.provider == "ollama":
        models = _fetch_ollama_embedding_models(creds.api_base)
        if models:
            return models, "api"
        return _catalog_fallback(creds.provider), "catalog"

    if creds.provider in ("openai", "dashscope"):
        try:
            models = _fetch_openai_compatible_embedding_models(
                creds.api_base, creds.api_key or ""
            )
            if models:
                return models, "api"
        except Exception:
            pass

    return _catalog_fallback(creds.provider), "catalog"


def _fetch_ollama_embedding_models(api_base: str) -> List[ModelOption]:
    base = (api_base or "").strip().rstrip("/")
    url = f"{base}/api/tags"
    request = Request(url, headers={"Accept": "application/json"})
    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    models = payload.get("models") or []
    options: List[ModelOption] = []
    for item in models:
        model_id = item.get("name") or item.get("model")
        if not model_id or not _is_embedding_model(model_id):
            continue
        options.append(ModelOption(id=model_id, label=model_id))
    return sorted(options, key=lambda item: item.id)


def _fetch_openai_compatible_embedding_models(
    api_base: str, api_key: str
) -> List[ModelOption]:
    client = OpenAI(
        api_key=api_key,
        base_url=_normalize_openai_api_base(api_base),
        timeout=30.0,
    )
    page = client.models.list()
    options: List[ModelOption] = []
    for item in page.data:
        model_id = getattr(item, "id", None) or getattr(item, "name", None)
        if not model_id or not _is_embedding_model(model_id):
            continue
        options.append(ModelOption(id=model_id, label=model_id))
    return sorted(options, key=lambda item: item.id.lower())


def verify_embedding_connection(
    *,
    db: Session,
    user_id: int,
    provider: str,
    model: str,
    api_base: Optional[str] = None,
    api_key: Optional[str] = None,
    config_id: Optional[int] = None,
) -> tuple[bool, str]:
    model = (model or "").strip()
    if not model:
        return False, "Model ID is required"

    creds = resolve_credentials(
        db=db,
        user_id=user_id,
        provider=provider,
        api_base=api_base,
        api_key=api_key,
        config_id=config_id,
    )

    try:
        from app.services.embedding.embedding_config_service import ResolvedEmbeddingRuntime

        runtime = ResolvedEmbeddingRuntime(
            provider=creds.provider,
            model=model,
            api_key=creds.api_key,
            api_base=creds.api_base or None,
        )
        embeddings = EmbeddingsFactory.create(runtime)
        embeddings.embed_query("ping")
        return True, "Connection verified successfully"
    except Exception as exc:
        return False, str(exc)

