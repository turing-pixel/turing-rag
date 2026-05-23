from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.user import User
from app.models.chat import Chat
from app.models.knowledge import KnowledgeBase
from app.schemas.chat import (
    ChatCreate,
    ChatResponse,
    ChatSummaryResponse,
    ChatUpdate,
    MessageResponse,
    MessageUpdate,
    SendMessageRequest,
)
from app.services.chat_message_ops import (
    delete_messages_after,
    delete_messages_from,
    get_owned_message,
    get_previous_user_message,
)
from app.services.chat_list_service import build_chat_summaries
from app.services.chat_resolve import require_chat_for_user
from app.services.kb_resolve import get_kb_for_user
from app.schemas.chat_mappers import (
    chat_to_response_with_sources,
    message_to_response,
)
from app.services.message_retrieval_persistence import load_sources_by_message_id
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


def _knowledge_bases_from_uuids(
    db: Session, refs: List[str], user_id: int
) -> List[KnowledgeBase]:
    if not refs:
        return []
    bases: List[KnowledgeBase] = []
    for ref in refs:
        kb = get_kb_for_user(db, ref, user_id)
        if not kb:
            raise HTTPException(
                status_code=400,
                detail="One or more knowledge bases not found",
            )
        bases.append(kb)
    return bases


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

    if default_config_id is None:
        for provider in providers:
            for model in provider.models:
                if model.is_default and model.config_id is None:
                    default_provider = model.provider
                    default_model = model.model
                    break
            if default_provider and default_model:
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


@router.get("/workspace", response_model=ChatResponse)
def get_or_create_workspace_chat(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return the user's active workspace chat (latest), creating one if needed."""
    chat = (
        db.query(Chat)
        .options(
            joinedload(Chat.knowledge_bases),
            joinedload(Chat.messages),
        )
        .filter(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc(), Chat.id.desc())
        .first()
    )
    if chat is not None:
        return chat_to_response_with_sources(db, chat)

    default_provider, default_model = get_default_llm_config(db, current_user.id)
    runtime = _resolve_chat_llm_runtime(
        db,
        current_user.id,
        llm_provider=default_provider,
        llm_model=default_model,
    )
    chat = Chat(title="Chat", user_id=current_user.id)
    _apply_runtime_to_chat(chat, runtime)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat_to_response_with_sources(db, chat)


@router.post("", response_model=ChatResponse)
def create_chat(
    *,
    db: Session = Depends(get_db),
    chat_in: ChatCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    knowledge_bases = _knowledge_bases_from_uuids(
        db, chat_in.knowledge_base_uuids, current_user.id
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
    return chat_to_response_with_sources(db, chat)

@router.get("", response_model=List[ChatSummaryResponse])
def get_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    return build_chat_summaries(
        db, user_id=current_user.id, skip=skip, limit=limit
    )

@router.get("/{chat_uuid}", response_model=ChatResponse)
def get_chat(
    *,
    db: Session = Depends(get_db),
    chat_uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    chat = require_chat_for_user(
        db,
        chat_uuid,
        current_user.id,
        load_knowledge_bases=True,
        load_messages=True,
    )
    return chat_to_response_with_sources(db, chat)


@router.patch("/{chat_uuid}", response_model=ChatResponse)
def update_chat(
    *,
    db: Session = Depends(get_db),
    chat_uuid: str,
    chat_in: ChatUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    chat = require_chat_for_user(
        db,
        chat_uuid,
        current_user.id,
        load_knowledge_bases=True,
    )

    if chat_in.title is not None:
        chat.title = chat_in.title

    if chat_in.knowledge_base_uuids is not None:
        chat.knowledge_bases = _knowledge_bases_from_uuids(
            db, chat_in.knowledge_base_uuids, current_user.id
        )

    llm_fields = {"llm_config_id", "llm_provider", "llm_model"}
    if llm_fields.intersection(chat_in.model_fields_set):
        runtime = _resolve_chat_llm_runtime(
            db,
            current_user.id,
            llm_config_id=(
                chat_in.llm_config_id
                if "llm_config_id" in chat_in.model_fields_set
                else chat.llm_config_id
            ),
            llm_provider=(
                chat_in.llm_provider
                if "llm_provider" in chat_in.model_fields_set
                else chat.llm_provider
            ),
            llm_model=(
                chat_in.llm_model
                if "llm_model" in chat_in.model_fields_set
                else chat.llm_model
            ),
        )
        _apply_runtime_to_chat(chat, runtime)

    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat_to_response_with_sources(db, chat)

def _parse_message_content(body: SendMessageRequest | dict) -> str:
    if isinstance(body, SendMessageRequest):
        return body.content.strip()
    if isinstance(body, dict) and body.get("content"):
        return str(body["content"]).strip()
    raise HTTPException(status_code=400, detail="content is required")


@router.patch("/{chat_uuid}/messages/{message_id}", response_model=MessageResponse)
def update_message(
    *,
    db: Session = Depends(get_db),
    chat_uuid: str,
    message_id: int,
    body: MessageUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    if not body.model_fields_set:
        raise HTTPException(status_code=400, detail="No fields to update")

    chat = require_chat_for_user(db, chat_uuid, current_user.id)
    message = get_owned_message(
        db,
        chat_id=chat.id,
        message_id=message_id,
        user_id=current_user.id,
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if body.content is not None:
        if message.role != "user":
            raise HTTPException(
                status_code=400,
                detail="Only user messages can be edited",
            )
        message.content = body.content.strip()
        if not message.content:
            raise HTTPException(status_code=400, detail="content must not be empty")
        delete_messages_after(db, chat_id=chat.id, after_message_id=message.id)

    if "feedback" in body.model_fields_set:
        if body.feedback is None:
            message.feedback = None
        else:
            if message.role != "assistant":
                raise HTTPException(
                    status_code=400,
                    detail="Feedback is only supported on assistant messages",
                )
            message.feedback = body.feedback

    db.add(message)
    db.commit()
    db.refresh(message)
    sources = (
        load_sources_by_message_id(db, [message.id]).get(message.id, [])
        if message.role == "assistant"
        else []
    )
    return message_to_response(message, chat.uuid, sources=sources)


@router.post("/{chat_uuid}/messages/{message_id}/regenerate")
async def regenerate_message(
    request: Request,
    *,
    db: Session = Depends(get_db),
    chat_uuid: str,
    message_id: int,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    chat = require_chat_for_user(
        db, chat_uuid, current_user.id, load_knowledge_bases=True
    )
    message = get_owned_message(
        db,
        chat_id=chat.id,
        message_id=message_id,
        user_id=current_user.id,
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.role == "assistant":
        prev_user = get_previous_user_message(
            db, chat_id=chat.id, before_message_id=message.id
        )
        if not prev_user:
            raise HTTPException(
                status_code=400,
                detail="No user message found before this assistant reply",
            )
        delete_messages_from(db, chat_id=chat.id, from_message_id=message.id)
        query = prev_user.content
    elif message.role == "user":
        delete_messages_after(db, chat_id=chat.id, after_message_id=message.id)
        query = message.content
    else:
        raise HTTPException(status_code=400, detail="Unsupported message role")

    db.commit()

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
            query=query,
            chat_id=chat.id,
            db=db,
            knowledge_base_ids=knowledge_base_ids,
            llm_runtime=runtime,
            is_disconnected=request.is_disconnected,
            persist_user_message=False,
        ):
            yield chunk

    return StreamingResponse(
        response_stream(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-data-stream": "v1",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{chat_uuid}/messages")
async def create_message(
    request: Request,
    *,
    db: Session = Depends(get_db),
    chat_uuid: str,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    chat = require_chat_for_user(
        db, chat_uuid, current_user.id, load_knowledge_bases=True
    )

    query = _parse_message_content(body)
    if not query:
        raise HTTPException(status_code=400, detail="content must not be empty")

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
            query=query,
            chat_id=chat.id,
            db=db,
            knowledge_base_ids=knowledge_base_ids,
            llm_runtime=runtime,
            is_disconnected=request.is_disconnected,
        ):
            yield chunk

    return StreamingResponse(
        response_stream(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-data-stream": "v1",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.delete("/{chat_uuid}")
def delete_chat(
    *,
    db: Session = Depends(get_db),
    chat_uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    chat = require_chat_for_user(db, chat_uuid, current_user.id)

    db.delete(chat)
    db.commit()
    return {"status": "success"}
