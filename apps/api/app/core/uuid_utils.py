"""ULID external identifiers (exposed as uuid in API and URLs)."""

from __future__ import annotations

from ulid import ULID


def new_uuid() -> str:
    return str(ULID())


def normalize_uuid(value: str | None) -> str | None:
    """Parse a ULID string for lookup."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return str(ULID.from_str(raw))
    except (ValueError, AttributeError):
        return None
