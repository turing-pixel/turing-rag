from app.services.citation_markdown import (
    normalize_assistant_response,
    normalize_citation_markdown,
)


def test_normalize_citation_format():
    assert normalize_citation_markdown("See [citation:3] here.") == (
        "See [citation](3) here."
    )


def test_normalize_bare_numeric_citation():
    assert normalize_citation_markdown("Text [5] end.") == (
        "Text [citation](5) end."
    )


def test_normalize_assistant_response_is_markdown_only():
    assert normalize_assistant_response("Answer [5].") == "Answer [citation](5)."
