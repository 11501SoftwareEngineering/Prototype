"""Response schemas for student sessions."""

from uuid import UUID

from pydantic import BaseModel


class CreateSessionResponse(BaseModel):
    """Response returned when a student creates or enters a session."""

    session_id: UUID
    topic_id: UUID
