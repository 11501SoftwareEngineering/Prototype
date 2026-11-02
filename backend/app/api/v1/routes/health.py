from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> dict[str, str]:
    result = {"status": "ok", "database": "ok", "redis": "ok"}

    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        result["database"] = "error"

    try:
        await redis.ping()
    except Exception:
        result["redis"] = "error"

    if "error" in (result["database"], result["redis"]):
        result["status"] = "error"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return result
