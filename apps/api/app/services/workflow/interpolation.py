"""Strict template interpolation for workflow steps."""

from __future__ import annotations

import re
from typing import Any

_VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")


def _resolve_path(context: dict[str, Any], path: str) -> Any:
    parts = path.split(".")
    current: Any = context
    for part in parts:
        if not isinstance(current, dict):
            raise KeyError(f"Cannot resolve '{path}': missing segment '{part}'")
        if part not in current:
            raise KeyError(f"Missing template variable: {path}")
        current = current[part]
    return current


def render_template(template: str, context: dict[str, Any]) -> str:
    """Replace {{path}} placeholders; raise KeyError if any path is missing."""

    def replacer(match: re.Match[str]) -> str:
        path = match.group(1)
        value = _resolve_path(context, path)
        if value is None:
            return ""
        return str(value)

    return _VAR_PATTERN.sub(replacer, template)


def build_execution_context(
    run_input: dict[str, Any],
    step_outputs: dict[str, Any],
) -> dict[str, Any]:
    steps_ctx: dict[str, Any] = {}
    for key, value in step_outputs.items():
        if isinstance(value, dict):
            steps_ctx[key] = value
        else:
            steps_ctx[key] = {"text": value}
    return {"input": run_input, "steps": steps_ctx}
