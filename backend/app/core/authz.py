"""Authorization helpers (config elevation, password-change gate)."""

from fastapi import HTTPException, status

from app.core.api_paths import path_is_exempt
from app.core.auth_policies import PASSWORD_CHANGE_EXEMPT_PATHS
from app.core.yaml_config import yaml_config
from app.models.user import User


def is_super_admin(current_user: User) -> bool:
    """Return whether the user is elevated via config, not API role."""
    return current_user.account_id in yaml_config.SUPER_ADMIN_ACCOUNTS


def is_reserved_super_admin_account(account_id: str) -> bool:
    """Return whether ``account_id`` is listed in ``SUPER_ADMIN_ACCOUNTS``."""
    return account_id in yaml_config.SUPER_ADMIN_ACCOUNTS


def enforce_must_change_password(current_user: User, *, path: str) -> None:
    """Block non-exempt routes while the user must change their password.

    Raises:
        HTTPException: 403 if ``must_change_password`` is set and ``path`` is
            not in ``PASSWORD_CHANGE_EXEMPT_PATHS``.
    """
    if current_user.password is None:
        return
    if not current_user.password.must_change_password:
        return
    if path_is_exempt(path, PASSWORD_CHANGE_EXEMPT_PATHS):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Password change required",
    )
