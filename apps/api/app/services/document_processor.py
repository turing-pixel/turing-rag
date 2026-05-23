import asyncio
import logging
import os
import hashlib
import tempfile
import traceback
from datetime import datetime
from app.db.session import SessionLocal
from io import BytesIO
from typing import Optional, List, Dict, Set, Union
from fastapi import UploadFile
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    UnstructuredMarkdownLoader,
    TextLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LangchainDocument
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.minio import get_minio_client
from app.models.knowledge import KnowledgeBase, ProcessingTask, Document, DocumentChunk
from app.services.chunk_record import ChunkRecord
import uuid
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import UnstructuredFileLoader
from minio.error import MinioException
from minio import Minio
from app.services.vector_store import VectorStoreFactory
from app.services.embedding.embedding_config_service import create_user_embeddings
from app.services.vector_store.base import BaseVectorStore


def _embeddings_for_kb(db: Session, kb_id: int):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        from app.services.embedding.embedding_factory import EmbeddingsFactory

        return EmbeddingsFactory.create()
    return create_user_embeddings(db, kb.user_id)


def _kb_uuid_for_internal_id(db: Session, kb_id: int) -> str:
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise ValueError(f"Knowledge base {kb_id} not found")
    return kb.uuid

EMBED_BATCH_SIZE = 64
CHUNK_PROGRESS_COMMIT_EVERY = 10

# Run sync processing off the event loop so GET /documents/tasks stays fast.
# Local Chroma HTTP (chroma run) often returns 502 under concurrent identity checks.
def _document_processing_concurrency() -> int:
    raw = os.getenv("DOCUMENT_PROCESSING_CONCURRENCY", "").strip()
    if raw.isdigit():
        return max(1, int(raw))
    if settings.VECTOR_STORE_TYPE.lower().strip() == "chroma":
        return 1
    return 2


_DOCUMENT_PROCESSING_SEMAPHORE = asyncio.Semaphore(_document_processing_concurrency())

# Progress bands (monotonic 0-100)
_PROGRESS_RESOLVE = 5
_PROGRESS_READ = 10
_PROGRESS_LOAD = 15
_PROGRESS_SPLIT = 25
_PROGRESS_VECTOR = 28
_PROGRESS_PREPARE = 29
_PROGRESS_STORE_START = 30
_PROGRESS_STORE_END = 55
_PROGRESS_EMBED_START = 55
_PROGRESS_EMBED_END = 95
_PROGRESS_DONE = 100


def _update_task_progress(
    task: ProcessingTask,
    db: Session,
    progress: int,
    message: Optional[str] = None,
    *,
    commit: bool = True,
) -> None:
    """Update task progress; percent is monotonic, message may refresh at the same stage."""
    progress = max(0, min(100, progress))
    current = task.progress or 0
    if progress < current and task.status == "processing" and message is None:
        return
    task.progress = max(current, progress)
    if message is not None:
        task.progress_message = message
    if commit:
        db.commit()


def _fail_processing_task(
    task: ProcessingTask, db: Session, error: Exception, stage: str
) -> None:
    task.status = "failed"
    task.error_message = str(error)
    task.progress_message = stage
    db.commit()


def _permanent_minio_path(kb_id: int, file_name: str) -> str:
    return f"kb_{kb_id}/{file_name}"


def _download_minio_to_temp(
    minio_client: Minio,
    object_name: str,
    local_path: str,
    task_id: int,
    logger: logging.Logger,
) -> None:
    logger.info(f"Task {task_id}: Downloading file from MinIO: {object_name}")
    minio_client.fget_object(
        bucket_name=settings.MINIO_BUCKET_NAME,
        object_name=object_name,
        file_path=local_path,
    )
    logger.info(f"Task {task_id}: File downloaded from MinIO successfully")


def _resolve_local_file_path(
    temp_path: str,
    file_name: str,
    kb_id: int,
    task_id: int,
    db: Session,
    minio_client: Minio,
    logger: logging.Logger,
) -> str:
    """Resolve a readable local path: local temp, then MinIO permanent path."""
    if temp_path and os.path.exists(temp_path):
        logger.info(f"Task {task_id}: Using local file: {temp_path}")
        return temp_path

    local_temp_path = f"/tmp/temp_{task_id}_{file_name}"
    minio_candidates = [_permanent_minio_path(kb_id, file_name)]
    if temp_path and temp_path not in minio_candidates:
        minio_candidates.append(temp_path)

    existing = (
        db.query(Document)
        .filter(
            Document.knowledge_base_id == kb_id,
            Document.file_name == file_name,
        )
        .first()
    )
    if existing and existing.file_path not in minio_candidates:
        minio_candidates.insert(0, existing.file_path)

    last_error: Optional[Exception] = None
    for object_name in minio_candidates:
        try:
            _download_minio_to_temp(
                minio_client, object_name, local_temp_path, task_id, logger
            )
            return local_temp_path
        except MinioException as e:
            last_error = e
            logger.warning(
                f"Task {task_id}: MinIO object not found at {object_name}: {e}"
            )

    raise Exception(
        f"Failed to get file from local or MinIO ({last_error})"
        if last_error
        else "Failed to get file: no valid path"
    )


def _clear_document_chunks_and_vectors(
    db: Session,
    document: Document,
    vector_store: BaseVectorStore,
    task_id: int,
    logger: logging.Logger,
) -> None:
    chunk_rows = (
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).all()
    )
    chunk_ids = [row.id for row in chunk_rows]
    if chunk_ids:
        try:
            vector_store.delete(chunk_ids)
        except Exception as e:
            logger.warning(f"Task {task_id}: Vector delete by ids failed: {e}")

    try:
        collection = vector_store._store._collection
        collection.delete(where={"document_id": document.id})
    except Exception as e:
        logger.warning(f"Task {task_id}: Vector delete by metadata failed: {e}")

    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
    db.flush()
    logger.info(
        f"Task {task_id}: Cleared {len(chunk_ids)} existing chunks for document {document.id}"
    )


class DocumentDeleteError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def delete_knowledge_base_document(
    db: Session,
    document: Document,
    kb_id: int,
) -> dict:
    """Delete a document and its vectors, chunks, tasks, and MinIO object."""
    logger = logging.getLogger(__name__)

    active_task = (
        db.query(ProcessingTask)
        .filter(
            ProcessingTask.document_id == document.id,
            ProcessingTask.status.in_(("pending", "processing")),
        )
        .first()
    )
    if active_task:
        raise DocumentDeleteError("Document is still being processed", 409)

    embeddings = _embeddings_for_kb(db, kb_id)
    vector_store = VectorStoreFactory.create(
        store_type=settings.VECTOR_STORE_TYPE,
        collection_name=f"kb_{kb_id}",
        embedding_function=embeddings,
    )
    _clear_document_chunks_and_vectors(db, document, vector_store, 0, logger)

    warnings: list[str] = []
    try:
        minio_client = get_minio_client()
        minio_client.remove_object(settings.MINIO_BUCKET_NAME, document.file_path)
        logger.info(
            "Removed MinIO object for document %s: %s",
            document.id,
            document.file_path,
        )
    except MinioException as exc:
        msg = f"Failed to remove file from storage: {exc}"
        warnings.append(msg)
        logger.warning(msg)

    db.query(ProcessingTask).filter(
        ProcessingTask.document_id == document.id
    ).delete(synchronize_session=False)
    db.delete(document)
    db.commit()

    payload: dict = {"message": "Document deleted successfully"}
    if warnings:
        payload["warnings"] = warnings
    return payload


class UploadResult(BaseModel):
    file_path: str
    file_name: str
    file_size: int
    content_type: str
    file_hash: str

class TextChunk(BaseModel):
    content: str
    metadata: Optional[Dict] = None

class PreviewResult(BaseModel):
    chunks: List[TextChunk]
    total_chunks: int

async def process_document(file_path: str, file_name: str, kb_id: int, document_id: int, chunk_size: int = 1000, chunk_overlap: int = 200) -> None:
    """Process document and store in vector database with incremental updates"""
    logger = logging.getLogger(__name__)
    
    try:
        preview_result = await preview_document(file_path, chunk_size, chunk_overlap)
        
        logger.info("Initializing embeddings for knowledge base %s", kb_id)
        db = SessionLocal()
        try:
            embeddings = _embeddings_for_kb(db, kb_id)
            kb_uuid = _kb_uuid_for_internal_id(db, kb_id)
        finally:
            db.close()

        logger.info(f"Initializing vector store with collection: kb_{kb_id}")
        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb_id}",
            embedding_function=embeddings,
        )
        
        # Initialize chunk record manager
        chunk_manager = ChunkRecord(kb_id)
        
        # Get existing chunk hashes for this file
        existing_hashes = chunk_manager.list_chunks(file_name)
        
        # Prepare new chunks
        new_chunks = []
        current_hashes = set()
        documents_to_update = []
        
        for chunk in preview_result.chunks:
            # Calculate chunk hash
            chunk_hash = hashlib.sha256(
                (chunk.content + str(chunk.metadata)).encode()
            ).hexdigest()
            current_hashes.add(chunk_hash)
            
            # Skip if chunk hasn't changed
            if chunk_hash in existing_hashes:
                continue
            
            # Create unique ID for the chunk
            chunk_id = hashlib.sha256(
                f"{kb_id}:{file_name}:{chunk_hash}".encode()
            ).hexdigest()
            
            # Prepare chunk record
            # Prepare metadata
            metadata = {
                **chunk.metadata,
                "chunk_id": chunk_id,
                "file_name": file_name,
                "kb_uuid": kb_uuid,
                "document_id": document_id,
            }
            
            new_chunks.append({
                "id": chunk_id,
                "kb_id": kb_id,
                "document_id": document_id,
                "file_name": file_name,
                "metadata": metadata,
                "hash": chunk_hash
            })
            
            # Prepare document for vector store
            doc = LangchainDocument(
                page_content=chunk.content,
                metadata=metadata
            )
            documents_to_update.append(doc)
        
        # Add new chunks to database and vector store
        if new_chunks:
            logger.info(f"Adding {len(new_chunks)} new/updated chunks")
            chunk_manager.add_chunks(new_chunks)
            vector_store.add_documents(documents_to_update)
        
        # Delete removed chunks
        chunks_to_delete = chunk_manager.get_deleted_chunks(current_hashes, file_name)
        if chunks_to_delete:
            logger.info(f"Removing {len(chunks_to_delete)} deleted chunks")
            chunk_manager.delete_chunks(chunks_to_delete)
            vector_store.delete(chunks_to_delete)
        
        logger.info("Document processing completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        raise

async def upload_document(file: UploadFile, kb_id: int) -> UploadResult:
    """Step 1: Upload document to MinIO"""
    content = await file.read()
    file_size = len(content)
    
    file_hash = hashlib.sha256(content).hexdigest()
    
    # Clean and normalize filename
    file_name = "".join(c for c in file.filename if c.isalnum() or c in ('-', '_', '.')).strip()
    object_path = f"kb_{kb_id}/{file_name}"
    
    content_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".md": "text/markdown",
        ".txt": "text/plain"
    }
    
    _, ext = os.path.splitext(file_name)
    content_type = content_types.get(ext.lower(), "application/octet-stream")
    
    # Upload to MinIO
    minio_client = get_minio_client()
    try:
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=object_path,
            data=BytesIO(content),
            length=file_size,
            content_type=content_type
        )
    except Exception as e:
        logging.error(f"Failed to upload file to MinIO: {str(e)}")
        raise
        
    return UploadResult(
        file_path=object_path,
        file_name=file_name,
        file_size=file_size,
        content_type=content_type,
        file_hash=file_hash
    )

async def preview_document(file_path: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> PreviewResult:
    """Step 2: Generate preview chunks"""
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    # 支持本地路径和 MinIO 路径
    if os.path.exists(file_path):
        # 本地文件，直接使用
        temp_path = file_path
        should_cleanup = False
    else:
        # 从 MinIO 下载
        minio_client = get_minio_client()
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            minio_client.fget_object(
                bucket_name=settings.MINIO_BUCKET_NAME,
                object_name=file_path,
                file_path=temp_file.name
            )
            temp_path = temp_file.name
            should_cleanup = True
    
    try:
        # Select appropriate loader
        if ext == ".pdf":
            loader = PyPDFLoader(temp_path)
        elif ext == ".docx":
            loader = Docx2txtLoader(temp_path)
        elif ext == ".md":
            loader = UnstructuredMarkdownLoader(temp_path)
        else:  # Default to text loader
            loader = TextLoader(temp_path)
        
        # Load and split the document
        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        chunks = text_splitter.split_documents(documents)
        
        # Convert to preview format
        preview_chunks = [
            TextChunk(
                content=chunk.page_content,
                metadata=chunk.metadata
            )
            for chunk in chunks
        ]
        
        return PreviewResult(
            chunks=preview_chunks,
            total_chunks=len(chunks)
        )
    finally:
        if should_cleanup and os.path.exists(temp_path):
            os.unlink(temp_path)

def _process_document_in_worker(
    temp_path: str,
    file_name: str,
    kb_id: int,
    task_id: int,
    db: Session = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> None:
    """Sync document pipeline; must run in a thread pool, not on the asyncio loop."""
    logger = logging.getLogger(__name__)
    logger.info(f"Starting background processing for task {task_id}, file: {file_name}")

    # if we don't pass in db, create a new database session
    if db is None:
        db = SessionLocal()
        should_close_db = True
    else:
        should_close_db = False
    
    task = db.query(ProcessingTask).get(task_id)
    if not task:
        logger.error(f"Task {task_id} not found")
        return
    
    try:
        logger.info(f"Task {task_id}: Setting status to processing")
        task.status = "processing"
        task.progress = 0
        task.progress_message = None
        task.error_message = None
        db.commit()

        minio_client = get_minio_client()
        _update_task_progress(
            task, db, _PROGRESS_RESOLVE, "Resolving file", commit=True
        )
        local_temp_path = _resolve_local_file_path(
            temp_path, file_name, kb_id, task_id, db, minio_client, logger
        )

        try:
            # 2. 加载和分块文档
            _, ext = os.path.splitext(file_name)
            ext = ext.lower()

            logger.info(f"Task {task_id}: Loading document with extension {ext}")
            _update_task_progress(
                task, db, _PROGRESS_READ, "Reading document", commit=True
            )
            # 选择合适的加载器
            if ext == ".pdf":
                loader = PyPDFLoader(local_temp_path)
            elif ext == ".docx":
                loader = Docx2txtLoader(local_temp_path)
            elif ext == ".md":
                loader = UnstructuredMarkdownLoader(local_temp_path)
            else:  # 默认使用文本加载器
                loader = TextLoader(local_temp_path)

            logger.info(f"Task {task_id}: Loading document content")
            documents = loader.load()
            _update_task_progress(
                task, db, _PROGRESS_LOAD, "Document loaded", commit=True
            )
            logger.info(f"Task {task_id}: Document loaded successfully")

            _update_task_progress(
                task, db, _PROGRESS_SPLIT, "Splitting into chunks", commit=True
            )
            logger.info(f"Task {task_id}: Splitting document into chunks")
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
            chunks = text_splitter.split_documents(documents)
            total_chunks = len(chunks)
            logger.info(f"Task {task_id}: Document split into {total_chunks} chunks")

            # 3. 创建向量存储
            logger.info(f"Task {task_id}: Initializing vector store")
            _update_task_progress(
                task, db, _PROGRESS_VECTOR, "Connecting to vector index", commit=True
            )
            embeddings = _embeddings_for_kb(db, kb_id)
            kb_uuid = _kb_uuid_for_internal_id(db, kb_id)
            try:
                vector_store = VectorStoreFactory.create(
                    store_type=settings.VECTOR_STORE_TYPE,
                    collection_name=f"kb_{kb_id}",
                    embedding_function=embeddings,
                )
            except Exception as e:
                raise RuntimeError(f"Vector store initialization failed: {e}") from e

            permanent_path = _permanent_minio_path(kb_id, file_name)
            existing_document = (
                db.query(Document)
                .filter(
                    Document.knowledge_base_id == kb_id,
                    Document.file_name == file_name,
                )
                .first()
            )

            if existing_document:
                document = existing_document
                permanent_path = document.file_path
                logger.info(
                    f"Task {task_id}: Reusing document record ID {document.id}, re-embedding"
                )
                _update_task_progress(
                    task, db, _PROGRESS_PREPARE, "Clearing old embeddings", commit=True
                )
                _clear_document_chunks_and_vectors(
                    db, document, vector_store, task_id, logger
                )
            else:
                try:
                    _update_task_progress(
                        task, db, _PROGRESS_PREPARE, "Saving file", commit=True
                    )
                    logger.info(f"Task {task_id}: Uploading file to permanent MinIO storage")
                    with open(local_temp_path, "rb") as f:
                        file_content = f.read()
                    minio_client.put_object(
                        bucket_name=settings.MINIO_BUCKET_NAME,
                        object_name=permanent_path,
                        data=BytesIO(file_content),
                        length=len(file_content),
                        content_type=task.document_upload.content_type
                        if task.document_upload
                        else "application/octet-stream",
                    )
                    logger.info(
                        f"Task {task_id}: File uploaded to permanent storage: {permanent_path}"
                    )
                except MinioException as e:
                    error_msg = f"Failed to upload file to permanent storage: {str(e)}"
                    logger.error(f"Task {task_id}: {error_msg}")
                    raise Exception(error_msg)

                logger.info(f"Task {task_id}: Creating document record")
                document = Document(
                    file_name=file_name,
                    file_path=permanent_path,
                    file_hash=task.document_upload.file_hash if task.document_upload else "",
                    file_size=task.document_upload.file_size if task.document_upload else 0,
                    content_type=task.document_upload.content_type
                    if task.document_upload
                    else "application/octet-stream",
                    knowledge_base_id=kb_id,
                )
                db.add(document)
                db.commit()
                db.refresh(document)
                logger.info(f"Task {task_id}: Document record created with ID {document.id}")

            # 6. 存储文档块
            logger.info(f"Task {task_id}: Storing document chunks")
            _update_task_progress(
                task, db, _PROGRESS_STORE_START, "Saving chunks", commit=True
            )
            store_span = _PROGRESS_STORE_END - _PROGRESS_STORE_START
            for i, chunk in enumerate(chunks):
                # 为每个 chunk 生成唯一的 ID
                chunk_id = hashlib.sha256(
                    f"{kb_id}:{file_name}:{chunk.page_content}".encode()
                ).hexdigest()

                chunk.metadata["source"] = file_name
                chunk.metadata["kb_uuid"] = kb_uuid
                chunk.metadata.pop("kb_id", None)
                chunk.metadata["document_id"] = document.id
                chunk.metadata["chunk_id"] = chunk_id

                doc_chunk = DocumentChunk(
                    id=chunk_id,
                    document_id=document.id,
                    kb_id=kb_id,
                    file_name=file_name,
                    chunk_metadata={
                        "page_content": chunk.page_content,
                        **chunk.metadata
                    },
                    hash=hashlib.sha256(
                        (chunk.page_content + str(chunk.metadata)).encode()
                    ).hexdigest()
                )
                db.add(doc_chunk)
                if total_chunks > 0 and (
                    i == total_chunks - 1
                    or (i + 1) % CHUNK_PROGRESS_COMMIT_EVERY == 0
                ):
                    stored = i + 1
                    pct = _PROGRESS_STORE_START + int(
                        store_span * stored / total_chunks
                    )
                    _update_task_progress(
                        task,
                        db,
                        pct,
                        f"Saving chunks {stored}/{total_chunks}",
                        commit=True,
                    )
                elif i > 0 and i % 100 == 0:
                    logger.info(f"Task {task_id}: Stored {i} chunks")
                    db.commit()

            db.commit()

            # 7. 添加到向量存储（分批以报告进度）
            logger.info(f"Task {task_id}: Adding chunks to vector store")
            _update_task_progress(
                task, db, _PROGRESS_EMBED_START, "Embedding", commit=True
            )
            embed_span = _PROGRESS_EMBED_END - _PROGRESS_EMBED_START
            if total_chunks == 0:
                _update_task_progress(
                    task, db, _PROGRESS_EMBED_END, "Embedding", commit=True
                )
            else:
                for start in range(0, total_chunks, EMBED_BATCH_SIZE):
                    batch = chunks[start : start + EMBED_BATCH_SIZE]
                    vector_store.add_documents(batch)
                    done = min(start + len(batch), total_chunks)
                    pct = _PROGRESS_EMBED_START + int(
                        embed_span * done / total_chunks
                    )
                    _update_task_progress(
                        task,
                        db,
                        pct,
                        f"Embedding {done}/{total_chunks}",
                        commit=True,
                    )
            logger.info(f"Task {task_id}: Chunks added to vector store")

            # 8. 更新任务状态
            logger.info(f"Task {task_id}: Updating task status to completed")
            task.status = "completed"
            task.progress = _PROGRESS_DONE
            task.progress_message = None
            task.document_id = document.id

            # 9. 更新上传记录状态
            upload = task.document_upload
            if upload:
                logger.info(f"Task {task_id}: Updating upload record status to completed")
                upload.status = "completed"

            db.commit()
            logger.info(f"Task {task_id}: Processing completed successfully")

        finally:
            # 清理本地临时文件（仅当不是原始上传路径时清理）
            try:
                if local_temp_path and local_temp_path != temp_path and os.path.exists(local_temp_path):
                    logger.info(f"Task {task_id}: Cleaning up local temp file")
                    os.remove(local_temp_path)
                    logger.info(f"Task {task_id}: Local temp file cleaned up")
            except Exception as e:
                logger.warning(f"Task {task_id}: Failed to clean up local temp file: {str(e)}")

    except Exception as e:
        logger.error(f"Task {task_id}: Error processing document: {str(e)}")
        logger.error(f"Task {task_id}: Stack trace: {traceback.format_exc()}")
        stage = task.progress_message or "Processing failed"
        if (task.progress or 0) <= _PROGRESS_VECTOR and "vector" in str(e).lower():
            stage = "Vector index connection failed"
        elif (task.progress or 0) >= _PROGRESS_EMBED_START:
            stage = "Embedding failed"
        _fail_processing_task(task, db, e, stage)
    finally:
        # if we create the db session, we need to close it
        if should_close_db and db:
            db.close()


async def process_document_background(
    temp_path: str,
    file_name: str,
    kb_id: int,
    task_id: int,
    db: Session = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> None:
    """Process document without blocking HTTP handlers (poll /tasks)."""
    async with _DOCUMENT_PROCESSING_SEMAPHORE:
        await asyncio.to_thread(
            _process_document_in_worker,
            temp_path,
            file_name,
            kb_id,
            task_id,
            db,
            chunk_size,
            chunk_overlap,
        )


def queue_document_reprocess(
    db: Session,
    kb_id: int,
    document_id: int,
) -> dict:
    """
    Re-embed an existing document from MinIO permanent storage.
    Clears old chunks/vectors and rebuilds with the current embedding config.
    """
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.knowledge_base_id == kb_id,
        )
        .first()
    )
    if not document:
        raise DocumentDeleteError("Document not found", 404)

    active_task = (
        db.query(ProcessingTask)
        .filter(
            ProcessingTask.document_id == document.id,
            ProcessingTask.status.in_(("pending", "processing")),
        )
        .first()
    )
    if active_task:
        raise DocumentDeleteError("Document is already being processed", 409)

    task = ProcessingTask(
        document_id=document.id,
        knowledge_base_id=kb_id,
        status="pending",
        progress=0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    asyncio.create_task(
        process_document_background(
            document.file_path,
            document.file_name,
            kb_id,
            task.id,
        )
    )
    return {"task_id": task.id, "document_id": document.id}


async def queue_retry_failed_processing_tasks(kb_id: int) -> dict:
    """Re-queue failed tasks (e.g. after Ollama was fixed). Uses MinIO permanent paths."""
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    queued = 0
    skipped = 0
    try:
        failed_tasks = (
            db.query(ProcessingTask)
            .filter(
                ProcessingTask.knowledge_base_id == kb_id,
                ProcessingTask.status == "failed",
            )
            .all()
        )
        for task in failed_tasks:
            upload = task.document_upload
            if not upload:
                skipped += 1
                continue
            task.status = "pending"
            task.progress = 0
            task.progress_message = None
            task.error_message = None
            db.commit()
            asyncio.create_task(
                process_document_background(
                    upload.temp_path,
                    upload.file_name,
                    kb_id,
                    task.id,
                )
            )
            queued += 1
        logger.info(
            "KB %s: queued %s failed tasks for re-embedding (%s skipped)",
            kb_id,
            queued,
            skipped,
        )
        return {"queued": queued, "skipped": skipped, "total_failed": len(failed_tasks)}
    finally:
        db.close()
