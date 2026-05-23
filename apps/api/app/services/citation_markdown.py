"""Normalize LLM citation markers to markdown links (mirrors apps/web chat-message.ts)."""

import re

_MULTI_CITATION_RE = re.compile(r"\[(\d+(?:\s*[,，]\s*\d+)+)\]")
_BARE_CITATION_RE = re.compile(r"(?<![\w])\[(\d+)\](?!\()")


def normalize_citation_markdown(text: str) -> str:
    if not text:
        return text

    normalized = text
    normalized = re.sub(r"\[\[([cC])itation", "[citation", normalized)
    normalized = re.sub(r"[cC]itation:(\d+)]]", r"citation:\1]", normalized)
    normalized = re.sub(
        r"\[\[([cC]itation:\d+)]](?!])",
        r"[\1]",
        normalized,
    )
    normalized = re.sub(
        r"\[[cC]itation:(\d+)]",
        r"[citation](\1)",
        normalized,
    )

    def _expand_multi(match: re.Match[str]) -> str:
        nums = re.split(r"[\s,，]+", match.group(1))
        return "".join(
            f"[citation]({n.strip()})" for n in nums if n.strip()
        )

    normalized = _MULTI_CITATION_RE.sub(_expand_multi, normalized)
    normalized = _BARE_CITATION_RE.sub(r"[citation](\1)", normalized)
    return normalized


def normalize_assistant_response(content: str) -> str:
    return normalize_citation_markdown(content)
