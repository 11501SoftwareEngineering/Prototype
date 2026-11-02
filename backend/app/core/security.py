from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.core.config import settings
from app.core.enums import UserRole

password_hash = PasswordHash.recommended()

# Used when the account is missing so login still pays verify cost (timing).
DUMMY_PASSWORD_HASH = password_hash.hash("timing-equalizer-not-a-real-password")


def generate_opaque_token() -> str:
    """Return a high-entropy opaque token for refresh/CSRF cookies."""
    return token_urlsafe(32)


def generate_initial_password() -> str:
    """Return a high-entropy initial password (URL-safe, >= 8 chars)."""
    # token_urlsafe(12) → 16 chars; fits Register/Login password max 128.
    return token_urlsafe(12)


def hash_token(raw_token: str) -> str:
    """Return a SHA-256 hex digest of an opaque token (for DB storage)."""
    return sha256(raw_token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash a plaintext password for storage.

    Args:
        password: Plaintext password.

    Returns:
        Password hash string suitable for persistence.
    """
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return whether the plaintext password matches the stored hash.

    Args:
        plain_password: Candidate plaintext password.
        hashed_password: Stored hash from ``hash_password``.

    Returns:
        ``True`` if the password matches; otherwise ``False``.
    """
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(
    subject: str | int | UUID,
    role: UserRole,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token for the given subject and role.

    Args:
        subject: Token subject (typically the user id); stored as ``sub``.
        role: System role claim stored as ``role``.
        expires_delta: Optional custom lifetime; defaults to
            ``settings.ACCESS_TOKEN_EXPIRE_MINUTES``.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": str(subject), "role": role.value, "exp": expire}
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token.

    Args:
        token: Encoded JWT string.

    Returns:
        Decoded claims dict (includes ``sub``, ``role``, ``exp``).

    Raises:
        jwt.PyJWTError: If the token is invalid, forged, or expired.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithms=[settings.JWT_ALGORITHM],
    )
