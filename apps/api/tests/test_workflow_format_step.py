import pytest

from app.services.workflow.steps import (
    infer_format_source_key,
    resolve_format_template,
)


def test_infer_format_source_key_skips_steps_without_text():
    outputs = {
        "retrieve_policy": {"context_text": "ctx", "text": "ctx"},
        "check_retrieval": {"halt": False, "passed": True},
        "draft_reply": {"text": "draft"},
        "compliance_review": {"text": "final reply"},
    }
    assert infer_format_source_key(outputs) == "compliance_review"


def test_resolve_format_template_uses_explicit_template():
    step = {
        "key": "format_reply",
        "template": "# Title\n\n{{steps.compliance_review.text}}",
    }
    assert resolve_format_template(step, {}) == "# Title\n\n{{steps.compliance_review.text}}"


def test_resolve_format_template_uses_source_key_when_template_empty():
    step = {"key": "format_output", "source_key": "compliance_review"}
    assert (
        resolve_format_template(step, {})
        == "{{steps.compliance_review.text}}"
    )


def test_resolve_format_template_infers_latest_text_step():
    step = {"key": "format_output"}
    outputs = {
        "analyze_question": {"text": "analysis"},
        "compliance_review": {"text": "reply"},
    }
    assert resolve_format_template(step, outputs) == "{{steps.compliance_review.text}}"


def test_resolve_format_template_rejects_empty_template_without_source():
    with pytest.raises(ValueError, match="Format step requires"):
        resolve_format_template({"key": "format_output"}, {})
