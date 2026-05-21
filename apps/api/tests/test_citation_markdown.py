from app.services.citation_markdown import (
    normalize_assistant_response,
    normalize_citation_markdown,
)

LLM_RESPONSE_SEPARATOR = "__LLM_RESPONSE__"


def test_normalize_citation_format():
    assert normalize_citation_markdown("See [citation:3] here.") == (
        "See [citation](3) here."
    )


def test_normalize_bare_numeric_citation():
    assert normalize_citation_markdown("Text [5] end.") == (
        "Text [citation](5) end."
    )


def test_normalize_assistant_response_preserves_context_prefix():
    raw = f"YmFzZTY0{LLM_RESPONSE_SEPARATOR}Answer [5]."
    result = normalize_assistant_response(raw)
    assert result.startswith(f"YmFzZTY0{LLM_RESPONSE_SEPARATOR}")
    assert result.endswith("Answer [citation](5).")
