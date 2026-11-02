from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import UserRole


class TeacherCreateRequest(BaseModel):
    account: str = Field(min_length=1, max_length=64, examples=["teacher1"])
    name: str = Field(min_length=1, max_length=128, examples=["Teacher One"])


class TeacherCreateResponse(BaseModel):
    account: str = Field(examples=["teacher1"])
    name: str = Field(examples=["Teacher One"])
    role: UserRole = Field(default=UserRole.TEACHER, examples=[UserRole.TEACHER])
    # One-time plaintext initial password; only returned on create.
    password: str = Field(examples=["generated-initial-password"])
    message: str = Field(
        default="Teacher created",
        examples=["Teacher created"],
    )


class TeacherListItem(BaseModel):
    id: UUID
    account: str = Field(examples=["teacher1"])
    name: str = Field(examples=["Teacher One"])
    created_at: datetime
