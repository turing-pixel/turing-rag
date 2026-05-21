DEFAULT_KB_ICON_COLOR = "primary"

ALLOWED_KB_ICON_COLORS = frozenset(
    {
        "primary",
        "blue",
        "sky",
        "cyan",
        "teal",
        "emerald",
        "lime",
        "amber",
        "orange",
        "rose",
        "pink",
        "fuchsia",
        "violet",
        "indigo",
        "slate",
    }
)


def normalize_kb_icon_color(color: str | None) -> str:
    if not color or not str(color).strip():
        return DEFAULT_KB_ICON_COLOR
    normalized = str(color).strip().lower()
    if normalized not in ALLOWED_KB_ICON_COLORS:
        raise ValueError(
            f"Invalid icon_color '{color}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_KB_ICON_COLORS))}"
        )
    return normalized
