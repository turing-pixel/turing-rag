from app.constants.kb_icon_colors import normalize_kb_icon_color
from app.constants.kb_icons import normalize_kb_icon
from app.schemas.knowledge import KnowledgeBaseResponse


def serialize_kb_response(kb) -> KnowledgeBaseResponse:
    payload = KnowledgeBaseResponse.model_validate(kb)
    return payload.model_copy(
        update={
            "icon": normalize_kb_icon(getattr(kb, "icon", None)),
            "icon_color": normalize_kb_icon_color(
                getattr(kb, "icon_color", None)
            ),
        }
    )
