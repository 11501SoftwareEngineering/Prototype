from redis.asyncio import Redis

from app.core.config import settings

redis_client: Redis = Redis.from_url(
    settings.REDIS_URL.get_secret_value(), decode_responses=True
)


async def get_redis() -> Redis:
    return redis_client


async def close_redis() -> None:
    await redis_client.aclose()
