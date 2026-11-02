"""API path prefix and path-matching helpers."""

# Must match ``app.include_router(..., prefix=...)`` in ``main.py``.
API_V1_PREFIX = "/api/v1"


def api_v1(*segments: str) -> str:
    """Build an absolute ``/api/v1/...`` path from route segments."""
    tail = "/".join(s.strip("/") for s in segments if s and s.strip("/"))
    if not tail:
        return API_V1_PREFIX
    return f"{API_V1_PREFIX}/{tail}"


def normalize_path(path: str) -> str:
    """Normalize for exemption checks (strip trailing slash)."""
    return path.rstrip("/") or "/"


def path_is_exempt(request_path: str, exempt_paths: frozenset[str]) -> bool:
    """Return whether ``request_path`` is in an exemption set."""
    return normalize_path(request_path) in exempt_paths
