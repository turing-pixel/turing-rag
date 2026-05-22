"""Unit tests for chat list preview helpers."""

from app.services.chat_list_service import _preview_text
from app.services.citation_markdown import LLM_RESPONSE_SEPARATOR


def test_preview_text_strips_assistant_context_prefix():
    stored = f"eHl6{LLM_RESPONSE_SEPARATOR}Answer with [citation:1] here."
    preview = _preview_text(stored, "assistant")
    assert "Answer with" in preview
    assert LLM_RESPONSE_SEPARATOR not in preview
