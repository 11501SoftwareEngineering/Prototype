from fastapi import APIRouter

from app.api.deps import ActiveUser
from app.schemas.auth import CurrentUserResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUserResponse)
async def read_me(current_user: ActiveUser) -> CurrentUserResponse:
    """Return the authenticated user's profile.

    Args:
        current_user: Authenticated user (password-change gate applies;
            ``/me`` is exempt).

    Returns:
        ``CurrentUserResponse`` for the current user.

    Raises:
        AuthRequired: 401 if unauthenticated.
        HTTPException: 403 if password change is required on a non-exempt path.
    """
    return await auth_service.get_current_user_profile(current_user)
