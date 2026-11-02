from pydantic import BaseModel, Field

from app.core.enums import UserRole

# Keep in sync with Settings.DEFAULT_LANGUAGE_CODE (config default, not env).
_DEFAULT_LANGUAGE_CODE = "zh-TW"


class RegisterRequest(BaseModel):
    account: str = Field(min_length=1, max_length=64, examples=["alice"])
    password: str = Field(min_length=8, max_length=128, examples=["password1"])
    name: str = Field(min_length=1, max_length=128, examples=["Alice"])


class RegisterResponse(BaseModel):
    account: str = Field(examples=["alice"])
    name: str = Field(examples=["Alice"])
    role: UserRole = Field(default=UserRole.USER, examples=[UserRole.USER])
    message: str = Field(
        default="Registration successful",
        examples=["Registration successful"],
    )


class LoginRequest(BaseModel):
    account: str = Field(min_length=1, max_length=64, examples=["alice"])
    password: str = Field(min_length=1, max_length=128, examples=["password1"])


class LoginResponse(BaseModel):
    """Login profile only; access JWT is ``Authorization`` response header."""

    account: str = Field(examples=["alice"])
    name: str = Field(examples=["Alice"])
    role: UserRole = Field(examples=[UserRole.USER])
    preferred_language: str = Field(
        default=_DEFAULT_LANGUAGE_CODE,
        examples=[_DEFAULT_LANGUAGE_CODE],
    )
    must_change_password: bool = Field(default=False, examples=[False])


class CurrentUserResponse(BaseModel):
    account: str = Field(examples=["alice"])
    name: str = Field(examples=["Alice"])
    role: UserRole = Field(examples=[UserRole.USER])
    preferred_language: str = Field(
        default=_DEFAULT_LANGUAGE_CODE,
        examples=[_DEFAULT_LANGUAGE_CODE],
    )
    must_change_password: bool = Field(default=False, examples=[False])


class PasswordChangeRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=128, examples=["password1"])
    new_password: str = Field(min_length=8, max_length=128, examples=["password2"])


class PasswordChangeResponse(BaseModel):
    message: str = Field(
        default="Password updated",
        examples=["Password updated"],
    )


class OkResponse(BaseModel):
    ok: bool = True
