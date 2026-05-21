from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.user import User
from app.models.chat import Chat, Message
from app.models.knowledge import KnowledgeBase
from app.schemas.chat import (
    ChatCreate,
    ChatResponse,
    ChatUpdate,
    MessageCreate,
    MessageResponse
)
from app.schemas.llm import LlmModelsListResponse, LlmProviderOptionResponse, LlmModelOptionResponse
from app.core.security import get_current_user
from app.services.chat_service import generate_response
from app.services.llm.llm_config_service import ResolvedLlmRuntime
from app.services.llm.llm_models import (
    get_available_llm_providers,
    get_default_llm_config,
    resolve_chat_llm_runtime,
)

router = APIRouter()


def _apply_runtime_to_chat(chat: Chat, runtime: ResolvedLlmRuntime) -> None:
    chat.llm_config_id = runtime.config_id
    chat.llm_provider = runtime.provider
    chat.llm_model = runtime.model


def _resolve_chat_llm_runtime(
    db: Session,
    user_id: int,
    llm_config_id: int | None = None,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> ResolvedLlmRuntime:
    try:
        return resolve_chat_llm_runtime(
            db,
            user_id,
            llm_config_id=llm_config_id,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/models", response_model=LlmModelsListResponse)
def list_llm_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    providers = get_available_llm_providers(db, current_user.id)
    default_provider, default_model = get_default_llm_config(db, current_user.id)
    default_config_id = None
    for provider in providers:
        for model in provider.models:
            if model.is_default and model.config_id is not None:
                default_config_id = model.config_id
                default_provider = model.provider
                default_model = model.model
                break
        if default_config_id is not None:
            break

    return LlmModelsListResponse(
        providers=[
            LlmProviderOptionResponse(
                provider=provider.provider,
                label=provider.label,
                models=[
                    LlmModelOptionResponse(
                        provider=model.provider,
                        model=model.model,
                        label=model.label,
                        is_default=model.is_default,
                        config_id=model.config_id,
                    )
                    for model in provider.models
                ],
            )
            for provider in providers
        ],
        default_provider=default_provider,
        default_model=default_model,
        default_config_id=default_config_id,
    )


@router.post("", response_model=ChatResponse)
def create_chat(
    *,
    db: Session = Depends(get_db),
    chat_in: ChatCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    knowledge_bases = (
        db.query(KnowledgeBase)
        .filter(
            KnowledgeBase.id.in_(chat_in.knowledge_base_ids),
            KnowledgeBase.user_id == current_user.id
        )
        .all()
    )
    if len(knowledge_bases) != len(chat_in.knowledge_base_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more knowledge bases not found"
        )

    runtime = _resolve_chat_llm_runtime(
        db,
        current_user.id,
        llm_config_id=chat_in.llm_config_id,
        llm_provider=chat_in.llm_provider,
        llm_model=chat_in.llm_model,
    )

    chat = Chat(
        title=chat_in.title,
        user_id=current_user.id,
    )
    _apply_runtime_to_chat(chat, runtime)
    chat.knowledge_bases = knowledge_bases

    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat

@router.get("", response_model=List[ChatResponse])
def get_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    chats = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases))
        .filter(Chat.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return chats

@router.get("/{chat_id}", response_model=ChatResponse)
def get_chat(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    chat = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases))
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.patch("/{chat_id}", response_model=ChatResponse)
def update_chat(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    chat_in: ChatUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    chat = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases))
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id,
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat_in.title is not None:
        chat.title = chat_in.title

    if chat_in.knowledge_base_ids is not None:
        knowledge_bases = (
            db.query(KnowledgeBase)
            .filter(
                KnowledgeBase.id.in_(chat_in.knowledge_base_ids),
                KnowledgeBase.user_id == current_user.id,
            )
            .all()
        )
        if len(knowledge_bases) != len(chat_in.knowledge_base_ids):
            raise HTTPException(
                status_code=400,
                detail="One or more knowledge bases not found",
            )
        chat.knowledge_bases = knowledge_bases

    if (
        chat_in.llm_config_id is not None
        or chat_in.llm_provider is not None
        or chat_in.llm_model is not None
    ):
        runtime = _resolve_chat_llm_runtime(
            db,
            current_user.id,
            llm_config_id=chat_in.llm_config_id or chat.llm_config_id,
            llm_provider=chat_in.llm_provider or chat.llm_provider,
            llm_model=chat_in.llm_model or chat.llm_model,
        )
        _apply_runtime_to_chat(chat, runtime)

    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat

@router.post("/{chat_id}/messages")
async def create_message(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    messages: dict,
    current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    chat = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases))
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    last_message = messages["messages"][-1]
    if last_message["role"] != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")

    runtime = _resolve_chat_llm_runtime(
        db,
        current_user.id,
        llm_config_id=chat.llm_config_id,
        llm_provider=chat.llm_provider,
        llm_model=chat.llm_model,
    )

    knowledge_base_ids = [kb.id for kb in chat.knowledge_bases]

    async def response_stream():
        async for chunk in generate_response(
            query=last_message["content"],
            messages=messages,
            knowledge_base_ids=knowledge_base_ids,
            chat_id=chat_id,
            db=db,
            llm_runtime=runtime,
        ):
            yield chunk

    return StreamingResponse(
        response_stream(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-data-stream": "v1"
        }
    )

@router.delete("/{chat_id}")
def delete_chat(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    chat = (
        db.query(Chat)
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    db.delete(chat)
    db.commit()
    return {"status": "success"}
