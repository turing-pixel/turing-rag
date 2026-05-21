import hashlib
import os
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, BackgroundTasks, Query
from sqlalchemy.orm import Session
from langchain_chroma import Chroma
from sqlalchemy import text
import logging
from datetime import datetime, timedelta
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
import time
import asyncio

from app.db.session import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.models.knowledge import KnowledgeBase, Document, ProcessingTask, DocumentChunk, DocumentUpload
from app.schemas.knowledge import (
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
    DocumentResponse,
    PreviewRequest,
)
from app.services.kb_response import serialize_kb_response
from app.services.document_processor import (
    process_document_background,
    upload_document,
    preview_document,
    PreviewResult,
    queue_retry_failed_processing_tasks,
)
from app.core.config import settings
from app.core.minio import get_minio_client
from minio.error import MinioException
from app.services.vector_store import VectorStoreFactory
from app.services.embedding.embedding_factory import EmbeddingsFactory

router = APIRouter()

logger = logging.getLogger(__name__)

class TestRetrievalRequest(BaseModel):
    query: str
    kb_id: int
    top_k: int


@router.post("", response_model=KnowledgeBaseResponse)
def create_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_in: KnowledgeBaseCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create new knowledge base.
    """
    kb = KnowledgeBase(
        name=kb_in.name,
        description=kb_in.description,
        icon=kb_in.icon,
        icon_color=kb_in.icon_color,
        user_id=current_user.id
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    logger.info(f"Knowledge base created: {kb.name} for user {current_user.id}")
    return serialize_kb_response(kb)

@router.get("", response_model=List[KnowledgeBaseResponse])
def get_knowledge_bases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve knowledge bases.
    """
    knowledge_bases = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [serialize_kb_response(kb) for kb in knowledge_bases]

@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get knowledge base by ID.
    """
    from sqlalchemy.orm import joinedload
    
    kb = (
        db.query(KnowledgeBase)
        .options(
            joinedload(KnowledgeBase.documents)
            .joinedload(Document.processing_tasks)
        )
        .filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    return serialize_kb_response(kb)

@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    kb_in: KnowledgeBaseUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Update knowledge base.
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    update_data = kb_in.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "name" in update_data:
        name = (update_data["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update_data["name"] = name

    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip() or None

    if "icon" in update_data and update_data["icon"] is not None:
        from app.constants.kb_icons import normalize_kb_icon

        try:
            update_data["icon"] = normalize_kb_icon(update_data["icon"])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    if "icon_color" in update_data and update_data["icon_color"] is not None:
        from app.constants.kb_icon_colors import normalize_kb_icon_color

        try:
            update_data["icon_color"] = normalize_kb_icon_color(
                update_data["icon_color"]
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    for field, value in update_data.items():
        setattr(kb, field, value)

    db.add(kb)
    db.commit()
    db.refresh(kb)

    logger.info(f"Knowledge base updated: {kb.name} for user {current_user.id}")
    return serialize_kb_response(kb)

@router.delete("/{kb_id}")
async def delete_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Delete knowledge base and all associated resources.
    """
    logger = logging.getLogger(__name__)
    
    kb = (
        db.query(KnowledgeBase)
        .filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    try:
        # Get all document file paths before deletion
        document_paths = [doc.file_path for doc in kb.documents]
        
        # Initialize services
        minio_client = get_minio_client()
        embeddings = EmbeddingsFactory.create()

        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb_id}",
            embedding_function=embeddings,
        )
        
        # Clean up external resources first
        cleanup_errors = []
        
        # 1. Clean up MinIO files
        try:
            # Delete all objects with prefix kb_{kb_id}/
            objects = minio_client.list_objects(settings.MINIO_BUCKET_NAME, prefix=f"kb_{kb_id}/")
            for obj in objects:
                minio_client.remove_object(settings.MINIO_BUCKET_NAME, obj.object_name)
            logger.info(f"Cleaned up MinIO files for knowledge base {kb_id}")
        except MinioException as e:
            cleanup_errors.append(f"Failed to clean up MinIO files: {str(e)}")
            logger.error(f"MinIO cleanup error for kb {kb_id}: {str(e)}")
        
        # 2. Clean up vector store
        try:
            vector_store._store.delete_collection(f"kb_{kb_id}")
            logger.info(f"Cleaned up vector store for knowledge base {kb_id}")
        except Exception as e:
            cleanup_errors.append(f"Failed to clean up vector store: {str(e)}")
            logger.error(f"Vector store cleanup error for kb {kb_id}: {str(e)}")
        
        # Finally, delete database records in a single transaction
        db.delete(kb)
        db.commit()
        
        # Report any cleanup errors in the response
        if cleanup_errors:
            return {
                "message": "Knowledge base deleted with cleanup warnings",
                "warnings": cleanup_errors
            }
        
        return {"message": "Knowledge base and all associated resources deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete knowledge base: {str(e)}")

# Batch upload documents
@router.post("/{kb_id}/documents/upload")
async def upload_kb_documents(
    kb_id: int,
    files: List[UploadFile],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload multiple documents to MinIO.
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    results = []
    for file in files:
        # 1. 计算文件 hash
        file_content = await file.read()
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # 2. 检查是否存在完全相同的文件（名称和hash都相同）
        existing_document = db.query(Document).filter(
            Document.file_name == file.filename,
            Document.file_hash == file_hash,
            Document.knowledge_base_id == kb_id
        ).first()
        
        if existing_document:
            # 完全相同的文件，直接返回
            results.append({
                "document_id": existing_document.id,
                "file_name": existing_document.file_name,
                "status": "exists",
                "message": "文件已存在且已处理完成",
                "skip_processing": True
            })
            continue
        
        # 3. 保存到本地临时目录
        local_dir = "/tmp/rag_uploads"
        os.makedirs(local_dir, exist_ok=True)

        # 先创建上传记录获取 ID
        upload = DocumentUpload(
            knowledge_base_id=kb_id,
            file_name=file.filename,
            file_hash=file_hash,
            file_size=len(file_content),
            content_type=file.content_type,
            temp_path=""  # 暂时为空
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)

        # 用 upload.id 构建本地路径
        local_path = f"{local_dir}/{upload.id}_{file.filename}"
        with open(local_path, "wb") as f:
            f.write(file_content)

        # 更新 temp_path 为本地路径
        upload.temp_path = local_path
        db.commit()

        results.append({
            "upload_id": upload.id,
            "file_name": file.filename,
            "temp_path": local_path,
            "status": "pending",
            "skip_processing": False
        })
    
    return results

@router.post("/{kb_id}/documents/preview")
async def preview_kb_documents(
    kb_id: int,
    preview_request: PreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[int, PreviewResult]:
    """
    Preview multiple documents' chunks.
    """
    results = {}
    for doc_id in preview_request.document_ids:
        document = db.query(Document).join(KnowledgeBase).filter(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
            KnowledgeBase.user_id == current_user.id
        ).first()
        
        if document:
            file_path = document.file_path
        else:
            upload = db.query(DocumentUpload).join(KnowledgeBase).filter(
                DocumentUpload.id == doc_id,
                DocumentUpload.knowledge_base_id == kb_id,
                KnowledgeBase.user_id == current_user.id
            ).first()
            
            if not upload:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
            
            file_path = upload.temp_path
        
        preview = await preview_document(
            file_path,
            chunk_size=preview_request.chunk_size,
            chunk_overlap=preview_request.chunk_overlap
        )
        results[doc_id] = preview
    
    return results

@router.post("/{kb_id}/documents/process")
async def process_kb_documents(
    kb_id: int,
    upload_results: List[dict],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process multiple documents asynchronously.
    """
    start_time = time.time()
    
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    task_info = []
    upload_ids = []
    
    for result in upload_results:
        if result.get("skip_processing"):
            continue
        upload_ids.append(result["upload_id"])
    
    if not upload_ids:
        return {"tasks": []}
    
    uploads = db.query(DocumentUpload).filter(
        DocumentUpload.id.in_(upload_ids),
        DocumentUpload.knowledge_base_id == kb_id
    ).all()
    uploads_dict = {upload.id: upload for upload in uploads}
    if len(uploads_dict) != len(set(upload_ids)):
        raise HTTPException(status_code=400, detail="One or more upload IDs are invalid")
    
    all_tasks = []
    for upload_id in upload_ids:
        upload = uploads_dict.get(upload_id)
        if not upload:
            continue
            
        task = ProcessingTask(
            document_upload_id=upload_id,
            knowledge_base_id=kb_id,
            status="pending"
        )
        all_tasks.append(task)
    
    db.add_all(all_tasks)
    db.commit()
    
    for task in all_tasks:
        db.refresh(task)
    
    task_data = []
    for i, upload_id in enumerate(upload_ids):
        if i < len(all_tasks):
            task = all_tasks[i]
            upload = uploads_dict.get(upload_id)
            
            task_info.append({
                "upload_id": upload_id,
                "task_id": task.id
            })
            
            if upload:
                task_data.append({
                    "task_id": task.id,
                    "upload_id": upload_id,
                    "temp_path": upload.temp_path,
                    "file_name": upload.file_name
                })
    
    background_tasks.add_task(
        add_processing_tasks_to_queue,
        task_data,
        kb_id
    )
    
    return {"tasks": task_info}


@router.post("/{kb_id}/documents/retry-failed")
async def retry_failed_documents(
    kb_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Re-run embedding for tasks that failed (e.g. Ollama unreachable).
    Files are loaded from MinIO permanent storage when local temp is gone.
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id,
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    result = await queue_retry_failed_processing_tasks(kb_id)
    return result


async def add_processing_tasks_to_queue(task_data, kb_id):
    """Helper function to add document processing tasks to the queue without blocking the main response."""
    for data in task_data:
        asyncio.create_task(
            process_document_background(
                data["temp_path"],
                data["file_name"],
                kb_id,
                data["task_id"],
                None
            )
        )
    logger.info(f"Added {len(task_data)} document processing tasks to queue")

@router.post("/cleanup")
async def cleanup_temp_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clean up expired temporary files.
    """
    expired_time = datetime.utcnow() - timedelta(hours=24)
    expired_uploads = db.query(DocumentUpload).filter(
        DocumentUpload.created_at < expired_time
    ).all()
    
    minio_client = get_minio_client()
    for upload in expired_uploads:
        try:
            minio_client.remove_object(
                bucket_name=settings.MINIO_BUCKET_NAME,
                object_name=upload.temp_path
            )
        except MinioException as e:
            logger.error(f"Failed to delete temp file {upload.temp_path}: {str(e)}")
        
        db.delete(upload)
    
    db.commit()
    
    return {"message": f"Cleaned up {len(expired_uploads)} expired uploads"}

@router.get("/{kb_id}/documents/tasks")
async def get_processing_tasks(
    kb_id: int,
    task_ids: str = Query(..., description="Comma-separated list of task IDs to check status for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get status of multiple processing tasks.
    """
    task_id_list = [int(id.strip()) for id in task_ids.split(",")]
    
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    tasks = (
        db.query(ProcessingTask)
        .options(
            selectinload(ProcessingTask.document_upload)
        )
        .filter(
            ProcessingTask.id.in_(task_id_list),
            ProcessingTask.knowledge_base_id == kb_id
        )
        .all()
    )
    
    return {
        task.id: {
            "document_id": task.document_id,
            "status": task.status,
            "error_message": task.error_message,
            "upload_id": task.document_upload_id,
            "file_name": task.document_upload.file_name if task.document_upload else None
        }
        for task in tasks
    }

@router.get("/{kb_id}/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get document details by ID.
    """
    document = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document

@router.post("/test-retrieval")
async def test_retrieval(
    request: TestRetrievalRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Test retrieval quality for a given query against a knowledge base.
    """
    try:
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == request.kb_id,
            KnowledgeBase.user_id == current_user.id
        ).first()
        
        if not kb:
            raise HTTPException(
                status_code=404,
                detail=f"Knowledge base {request.kb_id} not found",
            )
        
        embeddings = EmbeddingsFactory.create()
        
        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{request.kb_id}",
            embedding_function=embeddings,
        )
        
        results = vector_store.similarity_search_with_score(request.query, k=request.top_k)
        
        response = []
        for doc, score in results:
            response.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": float(score)
            })
            
        return {"results": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
