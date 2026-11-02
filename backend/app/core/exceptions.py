"""App-level exceptions (handled in ``main`` or raised into FastAPI)."""

from app.core.auth_policies import AUTH_UNAUTHORIZED_DETAIL


class AuthRequired(Exception):
    """Raised when authentication fails.

    Set ``clear_cookies=True`` only when the refresh session is known dead
    (rejected renew / missing user after renew). Write paths with an expired
    Bearer must not clear cookies so a later GET can still silent-renew.
    """

    def __init__(
        self,
        detail: str = AUTH_UNAUTHORIZED_DETAIL,
        *,
        clear_cookies: bool = False,
    ) -> None:
        self.detail = detail
        self.clear_cookies = clear_cookies
        super().__init__(detail)
