"""Tests for the student session response schema."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.session import CreateSessionResponse


def test_session_response_serializes_ids() -> None:
    """Valid UUIDs become strings with the expected field names."""
    session_id = uuid4()
    topic_id = uuid4()

    response = CreateSessionResponse(session_id=session_id, topic_id=topic_id)

    assert response.model_dump(mode="json") == {
        "session_id": str(session_id),
        "topic_id": str(topic_id),
    }


@pytest.mark.parametrize("field", ["session_id", "topic_id"])
def test_session_response_rejects_invalid_uuid(field: str) -> None:
    """Neither ID may contain a value that is not a UUID."""
    payload = {"session_id": str(uuid4()), "topic_id": str(uuid4())}
    payload[field] = "not-a-uuid"

    with pytest.raises(ValidationError, match=field):
        CreateSessionResponse.model_validate(payload)


@pytest.mark.parametrize("field", ["session_id", "topic_id"])
def test_session_response_requires_ids(field: str) -> None:
    """Both IDs must be present."""
    payload = {"session_id": str(uuid4()), "topic_id": str(uuid4())}
    del payload[field]

    with pytest.raises(ValidationError, match=field):
        CreateSessionResponse.model_validate(payload)
