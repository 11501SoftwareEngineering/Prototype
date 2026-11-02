"""Auth path exemptions and shared unauthorized detail text."""

from app.core.api_paths import api_v1, normalize_path

# Paths allowed while must_change_password is true (segments match routers).
PASSWORD_CHANGE_EXEMPT_PATHS = frozenset(
    {
        normalize_path(api_v1("users", "me")),
        normalize_path(api_v1("auth", "password")),
        normalize_path(api_v1("auth", "logout")),
    }
)

# Unsafe methods that require double-submit CSRF (refresh-cookie logout).
CSRF_PROTECTED_PATHS = frozenset(
    {
        normalize_path(api_v1("auth", "logout")),
    }
)

AUTH_UNAUTHORIZED_DETAIL = "Not authenticated or token expired"
CURRENT_PASSWORD_INCORRECT_DETAIL = "Current password is incorrect"
NEW_PASSWORD_SAME_AS_CURRENT_DETAIL = (
    "New password must be different from the current password"
)
