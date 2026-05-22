from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import (
    USERNAME_MAX_LENGTH,
    USERNAME_MIN_LENGTH,
    validate_password_strength,
    validate_username_format,
)


class UserBase(BaseModel):
    email: EmailStr
    username: str
    is_active: bool = True
    is_superuser: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=USERNAME_MIN_LENGTH, max_length=USERNAME_MAX_LENGTH)
    password: str

    @field_validator("username")
    @classmethod
    def username_format(cls, value: str) -> str:
        stripped = value.strip()
        message = validate_username_format(stripped)
        if message:
            raise ValueError(message)
        return stripped

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        message = validate_password_strength(value)
        if message:
            raise ValueError(message)
        return value

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 