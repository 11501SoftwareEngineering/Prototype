from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, StrictBool


@dataclass(frozen=True)
class SessionPrivacyData:
    id: UUID
    user_id: UUID
    is_anonymous: bool


class UpdateSessionPrivacyRequest(BaseModel):
    is_anonymous: StrictBool


class UpdateSessionPrivacyResponse(BaseModel):
    session_id: UUID
    is_anonymous: bool
    message: str
