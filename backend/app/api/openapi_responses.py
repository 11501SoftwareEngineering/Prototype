"""Reusable OpenAPI ``responses=`` fragments for FastAPI routes."""

from __future__ import annotations

from typing import Any

from app.core.auth_policies import (
    AUTH_UNAUTHORIZED_DETAIL,
    CURRENT_PASSWORD_INCORRECT_DETAIL,
    NEW_PASSWORD_SAME_AS_CURRENT_DETAIL,
)


def json_detail_example(description: str, detail: Any) -> dict[str, Any]:
    """Build an OpenAPI response entry with a JSON ``detail`` example."""
    return {
        "description": description,
        "content": {
            "application/json": {
                "example": {"detail": detail},
            }
        },
    }


def json_detail_examples(description: str, examples: dict[str, Any]) -> dict[str, Any]:
    """Build an OpenAPI response entry with named JSON ``detail`` examples."""
    return {
        "description": description,
        "content": {
            "application/json": {
                "examples": {
                    name: {"value": {"detail": detail}}
                    for name, detail in examples.items()
                },
            }
        },
    }


_ACCOUNT_ALREADY_EXISTS_DETAIL = "Account already exists"
_ACCOUNT_NAME_RESERVED_DETAIL = "Account name reserved"

REGISTER_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: json_detail_examples(
        "Registration rejected",
        {
            "account_already_exists": _ACCOUNT_ALREADY_EXISTS_DETAIL,
            "account_name_reserved": _ACCOUNT_NAME_RESERVED_DETAIL,
        },
    ),
    422: json_detail_example(
        "Request validation failed",
        [
            {
                "type": "string_too_short",
                "loc": ["body", "password"],
                "msg": "String should have at least 8 characters",
            }
        ],
    ),
}

TEACHER_CREATE_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: json_detail_examples(
        "Teacher create rejected",
        {
            "account_already_exists": _ACCOUNT_ALREADY_EXISTS_DETAIL,
            "account_name_reserved": _ACCOUNT_NAME_RESERVED_DETAIL,
        },
    ),
    401: json_detail_example(
        AUTH_UNAUTHORIZED_DETAIL,
        AUTH_UNAUTHORIZED_DETAIL,
    ),
    422: json_detail_example(
        "Request validation failed",
        [
            {
                "type": "string_too_short",
                "loc": ["body", "account"],
                "msg": "String should have at least 1 character",
            }
        ],
    ),
}

PASSWORD_CHANGE_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: json_detail_examples(
        "Password change rejected",
        {
            "wrong_current_password": CURRENT_PASSWORD_INCORRECT_DETAIL,
            "same_as_current_password": NEW_PASSWORD_SAME_AS_CURRENT_DETAIL,
        },
    ),
    401: json_detail_example(
        AUTH_UNAUTHORIZED_DETAIL,
        AUTH_UNAUTHORIZED_DETAIL,
    ),
    422: json_detail_example(
        "Request validation failed",
        [
            {
                "type": "string_too_short",
                "loc": ["body", "new_password"],
                "msg": "String should have at least 8 characters",
            }
        ],
    ),
}
