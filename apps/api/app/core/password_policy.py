import re
from typing import Optional

USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 64
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")


def validate_password_strength(password: str) -> Optional[str]:
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number"
    return None


def validate_username_format(username: str) -> Optional[str]:
    name = username.strip()
    if len(name) < USERNAME_MIN_LENGTH:
        return f"Username must be at least {USERNAME_MIN_LENGTH} characters long"
    if len(name) > USERNAME_MAX_LENGTH:
        return f"Username must be at most {USERNAME_MAX_LENGTH} characters long"
    if not USERNAME_PATTERN.match(name):
        return "Username may only contain letters, numbers, and underscores"
    return None
