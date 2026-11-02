"""Double-submit CSRF for refresh-cookie logout only."""

from __future__ import annotations

import secrets

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.api_paths import normalize_path
from app.core.auth_policies import CSRF_PROTECTED_PATHS
from app.core.cookies import CSRF_COOKIE
from app.core.http_methods import SAFE_HTTP_METHODS

_CSRF_DETAIL = "CSRF token missing or mismatch"


class CsrfMiddleware(BaseHTTPMiddleware):
    """Require matching ``X-CSRF-Token`` on ``CSRF_PROTECTED_PATHS`` writes."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method in SAFE_HTTP_METHODS:
            return await call_next(request)
        if normalize_path(request.url.path) not in CSRF_PROTECTED_PATHS:
            return await call_next(request)

        cookie = request.cookies.get(CSRF_COOKIE)
        header = request.headers.get("X-CSRF-Token")
        if (
            cookie is None
            or header is None
            or not secrets.compare_digest(header, cookie)
        ):
            return JSONResponse(status_code=403, content={"detail": _CSRF_DETAIL})

        return await call_next(request)
