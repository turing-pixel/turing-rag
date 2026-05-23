import asyncio
import copy
import json
import logging
import os
from typing import Any, Awaitable, Callable, Dict, List, AsyncGenerator, Optional

from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.globals import set_verbose, set_debug
from langchain_core.documents import Document as LangchainDocument
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat import Chat, Message
from app.models.knowledge import Document, KnowledgeBase
from app.services.citation_markdown import normalize_assistant_response
from app.services.message_retrieval_persistence import persist_message_retrieval
from app.services.embedding.embedding_config_service import (
    create_user_embeddings_with_runtime,
    embedding_runtime_cache_key,
)
from app.services.llm.llm_config_service import ResolvedLlmRuntime
from app.services.llm.llm_factory import LLMFactory
from app.services.chat_retrieval import stream_retrieve_from_knowledge_bases
from app.services.vector_store_cache import get_kb_vector_store

logger = logging.getLogger(__name__)

_env = os.getenv("ENVIRONMENT", "development").lower()
if _env in ("development", "dev", "local"):
    set_verbose(True)
    set_debug(True)

RETRIEVAL_PREVIEW_MAX_LEN = 160
RETRIEVAL_SCORE_METADATA_KEY = "retrieval_score"


def _yield_stream_data(payload: Dict[str, Any]) -> str:
    """Vercel AI Data Stream v1 type `2` (JSON array payload)."""
    return f"2:{json.dumps([payload], ensure_ascii=False)}\n"


def _yield_stream_text(text: str) -> str:
    """Vercel AI Data Stream v1 type `0` (JSON-encoded string)."""
    return f"0:{json.dumps(text, ensure_ascii=False)}\n"


def _doc_retrieval_preview(doc: LangchainDocument) -> Dict[str, Any]:
    meta = doc.metadata or {}
    text = doc.page_content or ""
    preview = text[:RETRIEVAL_PREVIEW_MAX_LEN].replace("\n", " ")
    if len(text) > RETRIEVAL_PREVIEW_MAX_LEN:
        preview += "..."
    file_name = meta.get("file_name") or meta.get("source") or ""
    payload: Dict[str, Any] = {
        "file_name": str(file_name),
        "preview": preview,
        "document_id": meta.get("document_id"),
    }
    if meta.get("kb_uuid"):
        payload["kb_uuid"] = meta.get("kb_uuid")
    if meta.get(RETRIEVAL_SCORE_METADATA_KEY) is not None:
        payload["score"] = meta.get(RETRIEVAL_SCORE_METADATA_KEY)
    return payload


def _doc_retrieval_score(doc: LangchainDocument) -> float | None:
    raw = (doc.metadata or {}).get(RETRIEVAL_SCORE_METADATA_KEY)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _passes_retrieval_threshold(doc: LangchainDocument) -> bool:
    threshold = settings.retrieval_score_threshold
    score = _doc_retrieval_score(doc)
    if threshold is None or score is None:
        return True
    if settings.retrieval_score_mode == "similarity":
        return score >= threshold
    return score <= threshold


def _retrieval_quality_payload(
    docs: List[LangchainDocument],
    *,
    raw_recalled: int,
) -> Dict[str, Any]:
    scores = [
        score for doc in docs if (score := _doc_retrieval_score(doc)) is not None
    ]
    low_confidence = len(docs) == 0
    reason = None
    if low_confidence:
        reason = (
            "below_score_threshold"
            if raw_recalled > 0 and settings.retrieval_score_threshold is not None
            else "no_relevant_context"
        )
    payload: Dict[str, Any] = {
        "low_confidence": low_confidence,
        "confidence_reason": reason,
        "score_mode": settings.retrieval_score_mode,
        "score_threshold": settings.retrieval_score_threshold,
        "recalled_count": raw_recalled,
        "selected_count": len(docs),
    }
    if scores:
        payload["best_score"] = (
            max(scores)
            if settings.retrieval_score_mode == "similarity"
            else min(scores)
        )
    return payload


def _doc_citation_payload(doc: LangchainDocument) -> Dict[str, Any]:
    """Full citation payload for stream + UI (avoids base64 in text stream)."""
    meta = dict(doc.metadata or {})
    meta.pop("kb_id", None)
    preview = _doc_retrieval_preview(doc)
    return {
        **preview,
        "page_content": doc.page_content or "",
        "metadata": meta,
    }


def _build_chat_history(prior_messages: List[Message]) -> List:
    chat_history = []
    for message in prior_messages:
        if message.role == "user":
            chat_history.append(HumanMessage(content=message.content))
        elif message.role == "assistant":
            chat_history.append(AIMessage(content=message.content))
    return chat_history


def _strip_citation_page_content(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Remove full chunk bodies from persisted retrieval events."""
    stored = copy.deepcopy(payload)
    citations = stored.get("citations")
    if isinstance(citations, list):
        for item in citations:
            if isinstance(item, dict):
                item.pop("page_content", None)
    return stored


def _rollback_pending_messages(
    db: Session,
    *,
    bot_message: Message | None,
    user_message: Message | None,
    persist_user_message: bool,
) -> None:
    if bot_message is not None:
        db.delete(bot_message)
    if persist_user_message and user_message is not None:
        db.delete(user_message)
    db.commit()


def _yield_message_ids(
    bot_message: Message,
    user_message: Message | None,
) -> str:
    payload: Dict[str, Any] = {
        "type": "retrieval",
        "phase": "meta",
        "assistant_message_id": bot_message.id,
    }
    if user_message is not None:
        payload["user_message_id"] = user_message.id
    return _yield_stream_data(payload)


async def _resolve_search_query(
    query: str,
    chat_history: List,
    llm,
    contextualize_q_prompt: ChatPromptTemplate,
) -> str:
    if not chat_history:
        return query
    rephrase_chain = contextualize_q_prompt | llm | StrOutputParser()
    result = await rephrase_chain.ainvoke(
        {"input": query, "chat_history": chat_history}
    )
    return result if isinstance(result, str) else str(result)


async def _is_client_disconnected(
    is_disconnected: Optional[Callable[[], Awaitable[bool]]],
) -> bool:
    if is_disconnected is None:
        return False
    try:
        return await is_disconnected()
    except Exception:
        return False


async def generate_response(
    query: str,
    chat_id: int,
    db: Session,
    knowledge_base_ids: List[int],
    llm_runtime: ResolvedLlmRuntime | None = None,
    is_disconnected: Optional[Callable[[], Awaitable[bool]]] = None,
    *,
    persist_user_message: bool = True,
) -> AsyncGenerator[str, None]:
    bot_message: Message | None = None
    user_message: Message | None = None
    cancelled = False
    retrieval_events: List[Dict[str, Any]] = []
    rewrite_attempted = False
    search_query = query
    knowledge_base_refs: List[Dict[str, str]] = []

    try:
        prior_messages = (
            db.query(Message)
            .filter(Message.chat_id == chat_id)
            .order_by(Message.id.asc())
            .all()
        )
        chat_history = _build_chat_history(prior_messages)

        if persist_user_message:
            user_message = Message(content=query, role="user", chat_id=chat_id)
            db.add(user_message)
        bot_message = Message(content="", role="assistant", chat_id=chat_id)
        db.add(bot_message)
        db.commit()

        yield _yield_message_ids(bot_message, user_message)

        knowledge_bases = (
            db.query(KnowledgeBase)
            .filter(KnowledgeBase.id.in_(knowledge_base_ids))
            .all()
        )

        chat_row = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat_row:
            raise ValueError("Chat not found")
        embeddings, embedding_runtime = create_user_embeddings_with_runtime(
            db, chat_row.user_id
        )
        embedding_cache_key = embedding_runtime_cache_key(embedding_runtime)

        kb_by_uuid = {kb.uuid: kb for kb in knowledge_bases}
        vector_stores = []
        store_kb_uuids: List[str] = []
        for kb in knowledge_bases:
            has_documents = (
                db.query(Document.id)
                .filter(Document.knowledge_base_id == kb.id)
                .limit(1)
                .first()
            )
            if has_documents:
                vector_stores.append(
                    get_kb_vector_store(
                        user_id=chat_row.user_id,
                        kb_id=kb.id,
                        embedding_function=embeddings,
                        embedding_cache_key=embedding_cache_key,
                    )
                )
                store_kb_uuids.append(kb.uuid)

        if not vector_stores:
            error_msg = (
                "I don't have any knowledge base to help answer your question."
            )
            yield _yield_stream_text(error_msg)
            yield (
                'd:{"finishReason":"stop","usage":{"promptTokens":0,'
                '"completionTokens":0}}\n'
            )
            bot_message.content = error_msg
            db.commit()
            return

        llm = LLMFactory.create(
            provider=llm_runtime.provider if llm_runtime else None,
            model=llm_runtime.model if llm_runtime else None,
            api_key=llm_runtime.api_key if llm_runtime else None,
            api_base=llm_runtime.api_base if llm_runtime else None,
        )

        contextualize_q_system_prompt = (
            "Given a chat history and the latest user question "
            "which might reference context in the chat history, "
            "formulate a standalone question which can be understood "
            "without the chat history. Do NOT answer the question, just "
            "reformulate it if needed and otherwise return it as is."
        )
        contextualize_q_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", contextualize_q_system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

        qa_system_prompt = (
            "You are given a user question, and please write clean, concise and accurate answer to the question. "
            "You will be given a set of related contexts to the question, numbered sequentially starting from 1. "
            "Each context has an implicit reference number based on its position (first context is 1, second is 2, etc.). "
            "Cite sources using ONLY the format [citation:N] where N is an integer from 1 through the total number of contexts. "
            "Do not use bare brackets like [N], footnotes, or other citation styles. "
            "Your answer must be correct, accurate and written by an expert using an unbiased and professional tone. "
            "Please limit to 1024 tokens. Do not give any information that is not related to the question, and do not repeat. "
            "Say 'information is missing on' followed by the related topic, if the given context do not provide sufficient information. "
            "If a sentence draws from multiple contexts, list every applicable citation, like [citation:1][citation:2]. "
            "Other than code and specific names and citations, your answer must be written in the same language as the question. "
            "Be concise.\n\nContext: {context}\n\n"
            "Remember: Cite contexts by their position number and never cite a number greater than the number of contexts provided."
        )
        qa_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", qa_system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

        document_prompt = PromptTemplate.from_template("\n\n- {page_content}\n\n")

        question_answer_chain = create_stuff_documents_chain(
            llm,
            qa_prompt,
            document_variable_name="context",
            document_prompt=document_prompt,
        )

        chain_input = {
            "input": query,
            "chat_history": chat_history,
        }

        knowledge_base_refs = [
            {"uuid": kb.uuid, "name": kb.name} for kb in knowledge_bases
        ]
        start_payload = {
            "type": "retrieval",
            "phase": "start",
            "query": query,
            "knowledge_bases": knowledge_base_refs,
        }
        retrieval_events.append(_strip_citation_page_content(start_payload))
        yield _yield_stream_data(start_payload)

        if await _is_client_disconnected(is_disconnected):
            _rollback_pending_messages(
                db,
                bot_message=bot_message,
                user_message=user_message,
                persist_user_message=persist_user_message,
            )
            return

        try:
            if chat_history:
                rewrite_attempted = True
                rewrite_payload = {
                    "type": "retrieval",
                    "phase": "rewriting",
                    "query": query,
                }
                retrieval_events.append(
                    _strip_citation_page_content(rewrite_payload)
                )
                yield _yield_stream_data(rewrite_payload)

            search_query = await _resolve_search_query(
                query,
                chat_history,
                llm,
                contextualize_q_prompt,
            )
            if search_query != query:
                query_payload = {
                    "type": "retrieval",
                    "phase": "query",
                    "query": query,
                    "search_query": search_query,
                }
                retrieval_events.append(
                    _strip_citation_page_content(query_payload)
                )
                yield _yield_stream_data(query_payload)

            search_kbs = [
                {"uuid": kb_uuid, "name": kb_by_uuid[kb_uuid].name}
                for kb_uuid in store_kb_uuids
                if kb_uuid in kb_by_uuid
            ]
            search_payload = {
                "type": "retrieval",
                "phase": "search",
                "search_query": search_query,
                "knowledge_bases": search_kbs,
            }
            retrieval_events.append(_strip_citation_page_content(search_payload))
            yield _yield_stream_data(search_payload)

            retrieval_stats: Dict[str, int] = {"raw_recalled": 0}
            retrieved_docs: List[LangchainDocument] = []
            async for doc in stream_retrieve_from_knowledge_bases(
                search_query,
                vector_stores,
                store_kb_uuids,
                stats=retrieval_stats,
            ):
                meta = doc.metadata or {}
                kb_uuid = meta.get("kb_uuid")
                if kb_uuid and kb_uuid in kb_by_uuid:
                    kb = kb_by_uuid[kb_uuid]
                    meta["kb_name"] = kb.name
                    meta.pop("kb_id", None)
                    doc.metadata = meta
                retrieved_docs.append(doc)

                if await _is_client_disconnected(is_disconnected):
                    _rollback_pending_messages(
                        db,
                        bot_message=bot_message,
                        user_message=user_message,
                        persist_user_message=persist_user_message,
                    )
                    return

                searching_payload = {
                    "type": "retrieval",
                    "phase": "searching",
                    "search_query": search_query,
                    "documents": [_doc_retrieval_preview(doc)],
                    "count": len(retrieved_docs),
                }
                retrieval_events.append(
                    _strip_citation_page_content(searching_payload)
                )
                yield _yield_stream_data(searching_payload)
                await asyncio.sleep(0)
        except Exception as retriever_exc:
            raise RuntimeError(
                f"Document retrieval failed: {retriever_exc}"
            ) from retriever_exc

        if await _is_client_disconnected(is_disconnected):
            _rollback_pending_messages(
                db,
                bot_message=bot_message,
                user_message=user_message,
                persist_user_message=persist_user_message,
            )
            return

        if not retrieved_docs:
            empty_search_payload = {
                "type": "retrieval",
                "phase": "searching",
                "search_query": search_query,
                "count": 0,
            }
            retrieval_events.append(
                _strip_citation_page_content(empty_search_payload)
            )
            yield _yield_stream_data(empty_search_payload)

        raw_recalled = retrieval_stats.get("raw_recalled", len(retrieved_docs))
        retrieved_docs = [
            doc for doc in retrieved_docs if _passes_retrieval_threshold(doc)
        ]
        selected_count = len(retrieved_docs)
        quality_payload = _retrieval_quality_payload(
            retrieved_docs, raw_recalled=raw_recalled
        )
        ranking_payload = {
            "type": "retrieval",
            "phase": "ranking",
            "search_query": search_query,
            "recalled_count": raw_recalled,
            "selected_count": selected_count,
            "count": selected_count,
            **quality_payload,
            "documents": [_doc_retrieval_preview(doc) for doc in retrieved_docs],
        }
        retrieval_events.append(_strip_citation_page_content(ranking_payload))
        yield _yield_stream_data(ranking_payload)

        citation_payloads = [
            _doc_citation_payload(doc) for doc in (retrieved_docs or [])
        ]
        results_payload = {
            "type": "retrieval",
            "phase": "results",
            "search_query": search_query,
            "citations": citation_payloads,
            "recalled_count": raw_recalled,
            "selected_count": selected_count,
            "count": len(citation_payloads),
            **quality_payload,
        }
        retrieval_events.append(_strip_citation_page_content(results_payload))
        yield _yield_stream_data(results_payload)

        full_answer = ""
        qa_input = {**chain_input, "context": retrieved_docs or []}
        async for chunk in question_answer_chain.astream(qa_input):
            if await _is_client_disconnected(is_disconnected):
                cancelled = True
                break

            if isinstance(chunk, str):
                answer_chunk = chunk
            elif isinstance(chunk, dict):
                answer_chunk = chunk.get("answer") or chunk.get("output") or ""
                if not answer_chunk and len(chunk) == 1:
                    answer_chunk = next(iter(chunk.values()))
            else:
                answer_chunk = str(chunk)

            if not answer_chunk:
                continue

            full_answer += answer_chunk
            yield _yield_stream_text(answer_chunk)

        if cancelled:
            if full_answer.strip() and bot_message is not None:
                bot_message.content = normalize_assistant_response(full_answer)
                persist_message_retrieval(
                    db,
                    bot_message,
                    user_query=query,
                    search_query=search_query,
                    rewrite_attempted=rewrite_attempted,
                    knowledge_bases=knowledge_base_refs,
                    events=retrieval_events,
                    retrieved_docs=retrieved_docs,
                    quality=quality_payload,
                )
                db.commit()
            else:
                _rollback_pending_messages(
                    db,
                    bot_message=bot_message,
                    user_message=user_message,
                    persist_user_message=persist_user_message,
                )
            return

        if bot_message is not None:
            bot_message.content = normalize_assistant_response(full_answer)
            persist_message_retrieval(
                db,
                bot_message,
                user_query=query,
                search_query=search_query,
                rewrite_attempted=rewrite_attempted,
                knowledge_bases=knowledge_base_refs,
                events=retrieval_events,
                retrieved_docs=retrieved_docs,
                quality=quality_payload,
            )
            db.commit()
        yield 'd:{"finishReason":"stop"}\n'

    except Exception as e:
        error_message = f"Error generating response: {str(e)}"
        logger.exception("Chat generation failed for chat_id=%s", chat_id)
        yield f"3:{json.dumps({'text': error_message})}\n"

        if bot_message is not None:
            bot_message.content = error_message
            db.commit()
