from app.constants.kb_icon_colors import normalize_kb_icon_color
from app.constants.kb_icons import normalize_kb_icon
from app.schemas.knowledge import KnowledgeBaseResponse
from app.services.document_mappers import document_to_response


def serialize_kb_response(kb) -> KnowledgeBaseResponse:
    kb_uuid = kb.uuid
    documents = [
        document_to_response(doc, kb_uuid)
        for doc in (getattr(kb, "documents", None) or [])
    ]
    return KnowledgeBaseResponse(
        uuid=kb_uuid,
        name=kb.name,
        description=kb.description,
        icon=normalize_kb_icon(getattr(kb, "icon", None)),
        icon_color=normalize_kb_icon_color(getattr(kb, "icon_color", None)),
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        documents=documents,
    )
