"""Unit tests for chat list preview helpers."""

from app.services.chat_list_service import _preview_text


def test_preview_text_strips_citation_markers_from_assistant_content():
    stored = "Answer with [citation:1] here."
    preview = _preview_text(stored, "assistant")
    assert "Answer with" in preview
    assert "[citation" not in preview
