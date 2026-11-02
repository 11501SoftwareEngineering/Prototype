from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.session_privacy import (
    UpdateSessionPrivacyRequest,
    UpdateSessionPrivacyResponse,
)


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_privacy_request_accepts_boolean(is_anonymous: bool) -> None:
    request = UpdateSessionPrivacyRequest(is_anonymous=is_anonymous)

    assert request.is_anonymous is is_anonymous


@pytest.mark.parametrize("value", ["true", "false", 1, 0, None])
def test_privacy_request_rejects_non_boolean(value: object) -> None:
    with pytest.raises(ValidationError):
        UpdateSessionPrivacyRequest.model_validate({"is_anonymous": value})


def test_privacy_request_requires_is_anonymous() -> None:
    with pytest.raises(ValidationError):
        UpdateSessionPrivacyRequest.model_validate({})


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_privacy_response_serializes_to_json(is_anonymous: bool) -> None:
    session_id = UUID("12345678-1234-5678-1234-567812345678")
    response = UpdateSessionPrivacyResponse(
        session_id=session_id,
        is_anonymous=is_anonymous,
        message="匿名分享設定已更新",
    )

    assert response.model_dump(mode="json") == {
        "session_id": str(session_id),
        "is_anonymous": is_anonymous,
        "message": "匿名分享設定已更新",
    }
