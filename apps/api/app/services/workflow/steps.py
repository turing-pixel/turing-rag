"""Step executors for the workflow engine."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.orm import Session

from app.services.llm.llm_config_service import ResolvedLlmRuntime
from app.services.llm.llm_factory import LLMFactory
from app.services.retrieval_context_service import retrieve_context
from app.services.workflow.interpolation import build_execution_context, render_template


async def execute_retrieve_step(
    db: Session,
    user_id: int,
    step: dict[str, Any],
    run_input: dict[str, Any],
    step_outputs: dict[str, Any],
    knowledge_base_uuids: list[str],
    config: dict[str, Any],
) -> dict[str, Any]:
    ctx = build_execution_context(run_input, step_outputs)
    query_template = step.get("query_template") or step.get("query") or ""
    query = render_template(query_template, ctx)
    top_k = int(config.get("top_k") or step.get("top_k") or 12)
    threshold = config.get("score_threshold")

    result = await retrieve_context(
        db,
        user_id,
        query,
        knowledge_base_uuids,
        top_k=top_k,
        score_threshold=threshold,
    )
    citations = [d.to_dict() for d in result.documents]
    return {
        **result.to_dict(),
        "text": result.context_text,
        "citations": citations,
    }


async def execute_llm_step(
    db: Session,
    user_id: int,
    step: dict[str, Any],
    run_input: dict[str, Any],
    step_outputs: dict[str, Any],
    llm_runtime: ResolvedLlmRuntime,
) -> dict[str, Any]:
    ctx = build_execution_context(run_input, step_outputs)
    prompt = render_template(step.get("prompt") or "", ctx)
    system = step.get("system")
    messages = []
    if system:
        messages.append(SystemMessage(content=render_template(system, ctx)))
    messages.append(HumanMessage(content=prompt))

    llm = LLMFactory.create(
        provider=llm_runtime.provider,
        model=llm_runtime.model,
        api_key=llm_runtime.api_key,
        api_base=llm_runtime.api_base,
    )
    response = await llm.ainvoke(messages)
    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)
    return {"text": text}


async def execute_condition_step(
    step: dict[str, Any],
    run_input: dict[str, Any],
    step_outputs: dict[str, Any],
) -> dict[str, Any]:
    ctx = build_execution_context(run_input, step_outputs)
    when = step.get("when", "low_confidence")
    halt = False
    message = None

    if when == "low_confidence":
        retrieve_key = step.get("retrieve_step_key", "retrieve_rules")
        retrieve_out = step_outputs.get(retrieve_key) or {}
        if isinstance(retrieve_out, dict) and retrieve_out.get("low_confidence"):
            halt = True
            message = step.get(
                "message",
                "检索置信度较低，请补充知识库资料或调整输入后重试。",
            )
    elif when == "custom":
        field_path = step.get("field", "")
        expected = step.get("equals")
        try:
            from app.services.workflow.interpolation import _resolve_path

            actual = _resolve_path(ctx, field_path)
            halt = actual != expected
        except KeyError:
            halt = True
            message = f"Condition field missing: {field_path}"

    return {"halt": halt, "message": message, "passed": not halt}


def _step_has_text_output(output: Any) -> bool:
    if not isinstance(output, dict):
        return output is not None
    text = output.get("text")
    return text is not None and str(text).strip() != ""


def infer_format_source_key(step_outputs: dict[str, Any]) -> str | None:
    """Pick the latest prior step that produced non-empty text output."""
    for key in reversed(list(step_outputs.keys())):
        if _step_has_text_output(step_outputs.get(key)):
            return key
    return None


def resolve_format_template(step: dict[str, Any], step_outputs: dict[str, Any]) -> str:
    template = (step.get("template") or "").strip()
    source_key = (step.get("source_key") or "").strip()

    if template:
        return template

    if source_key:
        return f"{{{{steps.{source_key}.text}}}}"

    inferred = infer_format_source_key(step_outputs)
    if inferred:
        return f"{{{{steps.{inferred}.text}}}}"

    raise ValueError(
        "Format step requires a non-empty template, source_key, "
        "or a prior step with text output."
    )


async def execute_format_step(
    step: dict[str, Any],
    run_input: dict[str, Any],
    step_outputs: dict[str, Any],
) -> dict[str, Any]:
    ctx = build_execution_context(run_input, step_outputs)
    fmt = step.get("format", "markdown")
    template = resolve_format_template(step, step_outputs)
    text = render_template(template, ctx) if "{{" in template else template
    return {"format": fmt, "text": text}


async def execute_step(
    db: Session,
    user_id: int,
    step: dict[str, Any],
    run_input: dict[str, Any],
    step_outputs: dict[str, Any],
    *,
    knowledge_base_uuids: list[str],
    config: dict[str, Any],
    llm_runtime: ResolvedLlmRuntime,
) -> dict[str, Any]:
    step_type = step.get("type")
    if step_type == "retrieve":
        return await execute_retrieve_step(
            db,
            user_id,
            step,
            run_input,
            step_outputs,
            knowledge_base_uuids,
            config,
        )
    if step_type == "llm":
        return await execute_llm_step(
            db, user_id, step, run_input, step_outputs, llm_runtime
        )
    if step_type == "condition":
        return await execute_condition_step(step, run_input, step_outputs)
    if step_type == "format":
        return await execute_format_step(step, run_input, step_outputs)
    raise ValueError(f"Unsupported step type: {step_type}")
