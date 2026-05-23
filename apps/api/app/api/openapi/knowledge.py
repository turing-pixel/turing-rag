from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from langchain_chroma import Chroma
from app.services.vector_store import VectorStoreFactory

from app import models
from app.db.session import get_db
from app.core.security import get_api_key_user
from app.core.config import settings
from app.services.embedding.embedding_config_service import create_user_embeddings
from app.services.kb_resolve import require_kb_for_user

router = APIRouter()

@router.get("/{kb_uuid}/query")
def query_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_uuid: str,
    query: str,
    top_k: int = 3,
    current_user: models.User = Depends(get_api_key_user),
) -> Any:
    """
    Query a specific knowledge base using API key authentication
    """
    try:
        kb = require_kb_for_user(db, kb_uuid, current_user.id)

        embeddings = create_user_embeddings(db, current_user.id)

        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb.id}",
            embedding_function=embeddings,
        )
        
        results = vector_store.similarity_search_with_score(query, k=top_k)
        
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