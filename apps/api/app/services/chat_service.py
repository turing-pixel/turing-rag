import asyncio
import base64
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
from app.services.citation_markdown import (
    LLM_RESPONSE_SEPARATOR,
    normalize_assistant_response,
)
from app.services.embedding.embedding_config_service import create_user_embeddings
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
    return {
        "file_name": str(file_name),
        "preview": preview,
        "document_id": meta.get("document_id"),
        "kb_id": meta.get("kb_id"),
    }


def _doc_citation_payload(doc: LangchainDocument) -> Dict[str, Any]:
    """Full citation payload for stream + UI (avoids base64 in text stream)."""
    meta = doc.metadata or {}
    preview = _doc_retrieval_preview(doc)
    return {
        **preview,
        "page_content": doc.page_content or "",
        "metadata": dict(meta),
    }


def _build_chat_history(prior_messages: List[Message]) -> List:
    chat_history = []
    for message in prior_messages:
        if message.role == "user":
            chat_history.append(HumanMessage(content=message.content))
        elif message.role == "assistant":
            content = message.content
            if LLM_RESPONSE_SEPARATOR in content:
                content = content.split(LLM_RESPONSE_SEPARATOR, 1)[-1]
            chat_history.append(AIMessage(content=content))
    return chat_history


def _serialize_context(retrieved_docs: List[LangchainDocument]) -> str:
    serializable_context = [
        {
            "page_content": doc.page_content or "",
            "metadata": doc.metadata,
        }
        for doc in retrieved_docs
    ]
    return base64.b64encode(
        json.dumps({"context": serializable_context}, ensure_ascii=False).encode()
    ).decode()


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
        embeddings = create_user_embeddings(db, chat_row.user_id)

        kb_by_id = {kb.id: kb for kb in knowledge_bases}
        vector_stores = []
        store_kb_ids: List[int] = []
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
                    )
                )
                store_kb_ids.append(kb.id)

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

        yield _yield_stream_data(
            {
                "type": "retrieval",
                "phase": "start",
                "query": query,
                "knowledge_bases": [
                    {"id": kb.id, "name": kb.name} for kb in knowledge_bases
                ],
            }
        )

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
                yield _yield_stream_data(
                    {
                        "type": "retrieval",
                        "phase": "rewriting",
                        "query": query,
                    }
                )

            search_query = await _resolve_search_query(
                query,
                chat_history,
                llm,
                contextualize_q_prompt,
            )
            if search_query != query:
                yield _yield_stream_data(
                    {
                        "type": "retrieval",
                        "phase": "query",
                        "query": query,
                        "search_query": search_query,
                    }
                )

            search_kbs = [
                {"id": kb_id, "name": kb_by_id[kb_id].name}
                for kb_id in store_kb_ids
                if kb_id in kb_by_id
            ]
            yield _yield_stream_data(
                {
                    "type": "retrieval",
                    "phase": "search",
                    "search_query": search_query,
                    "knowledge_bases": search_kbs,
                }
            )

            retrieval_stats: Dict[str, int] = {"raw_recalled": 0}
            retrieved_docs: List[LangchainDocument] = []
            async for doc in stream_retrieve_from_knowledge_bases(
                search_query,
                vector_stores,
                store_kb_ids,
                stats=retrieval_stats,
            ):
                meta = doc.metadata or {}
                kb_id = meta.get("kb_id")
                if kb_id is not None and kb_id in kb_by_id:
                    meta["kb_name"] = kb_by_id[kb_id].name
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

                yield _yield_stream_data(
                    {
                        "type": "retrieval",
                        "phase": "searching",
                        "search_query": search_query,
                        "documents": [_doc_retrieval_preview(doc)],
                        "count": len(retrieved_docs),
                    }
                )
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
            yield _yield_stream_data(
                {
                    "type": "retrieval",
                    "phase": "searching",
                    "search_query": search_query,
                    "count": 0,
                }
            )

        raw_recalled = retrieval_stats.get("raw_recalled", len(retrieved_docs))
        selected_count = len(retrieved_docs)
        yield _yield_stream_data(
            {
                "type": "retrieval",
                "phase": "ranking",
                "search_query": search_query,
                "recalled_count": raw_recalled,
                "selected_count": selected_count,
                "count": selected_count,
                "documents": [
                    _doc_retrieval_preview(doc) for doc in retrieved_docs
                ],
            }
        )

        citation_payloads = [
            _doc_citation_payload(doc) for doc in (retrieved_docs or [])
        ]
        yield _yield_stream_data(
            {
                "type": "retrieval",
                "phase": "results",
                "search_query": search_query,
                "citations": citation_payloads,
                "recalled_count": raw_recalled,
                "selected_count": selected_count,
                "count": len(citation_payloads),
            }
        )

        base64_context = _serialize_context(retrieved_docs or [])
        separator = LLM_RESPONSE_SEPARATOR
        # Stream only the separator; full context is in retrieval results + DB.
        yield _yield_stream_text(separator)
        full_response = base64_context + separator

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

            full_response += answer_chunk
            yield _yield_stream_text(answer_chunk)

        if cancelled:
            answer_part = (
                full_response.split(separator, 1)[-1].strip()
                if separator in full_response
                else ""
            )
            if answer_part:
                bot_message.content = normalize_assistant_response(full_response)
                db.commit()
            else:
                _rollback_pending_messages(
                    db,
                    bot_message=bot_message,
                    user_message=user_message,
                    persist_user_message=persist_user_message,
                )
            return

        bot_message.content = normalize_assistant_response(full_response)
        db.commit()
        yield 'd:{"finishReason":"stop"}\n'

    except Exception as e:
        error_message = f"Error generating response: {str(e)}"
        logger.exception("Chat generation failed for chat_id=%s", chat_id)
        yield f"3:{json.dumps({'text': error_message})}\n"

        if bot_message is not None:
            bot_message.content = error_message
            db.commit()
