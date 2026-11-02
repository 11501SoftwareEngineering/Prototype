"""Sanitize request-validation payloads so secrets are not echoed."""

from __future__ import annotations

from typing import Any

_SENSITIVE_FIELDS = frozenset({"password", "old_password", "new_password"})


def _redact_sensitive_input(value: Any) -> Any:
    """Drop sensitive keys from nested dict/list ``input`` values."""
    if isinstance(value, dict):
        return {
            key: _redact_sensitive_input(item)
            for key, item in value.items()
            if not (isinstance(key, str) and key in _SENSITIVE_FIELDS)
        }
    if isinstance(value, list):
        return [_redact_sensitive_input(item) for item in value]
    return value


def sanitize_validation_errors(errors: list[Any]) -> list[dict[str, Any]]:
    """Keep field names in ``loc``; omit password ``input`` values.

    When ``loc`` names a sensitive field, drop ``input`` entirely. Otherwise
    recursively strip sensitive keys from dict/list ``input`` payloads so a
    sibling-field failure (e.g. missing ``name``) cannot echo a password.
    """
    sanitized: list[dict[str, Any]] = []
    for raw in errors:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        loc = item.get("loc", ())
        loc_parts = list(loc) if isinstance(loc, (list, tuple)) else [loc]
        if any(
            isinstance(part, str) and part in _SENSITIVE_FIELDS for part in loc_parts
        ):
            item.pop("input", None)
        elif "input" in item:
            item["input"] = _redact_sensitive_input(item["input"])
        sanitized.append(item)
    return sanitized
