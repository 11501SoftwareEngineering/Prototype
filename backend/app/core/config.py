from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

NonEmptyStr = Annotated[str, Field(min_length=1)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_ENV: NonEmptyStr
    APP_NAME: NonEmptyStr
    APP_HOST: NonEmptyStr
    APP_PORT: int
    CORS_ORIGINS: list[str]

    # Database (PostgreSQL)
    POSTGRES_USER: Annotated[SecretStr, Field(min_length=1)]
    POSTGRES_DB: Annotated[SecretStr, Field(min_length=1)]
    POSTGRES_PASSWORD: Annotated[SecretStr, Field(min_length=1)]
    POSTGRES_HOST: Annotated[SecretStr, Field(min_length=1)] = "localhost"
    POSTGRES_PORT: Annotated[SecretStr, Field(min_length=1)] = 5432

    @computed_field
    def DATABASE_URL(self) -> SecretStr:
        user = self.POSTGRES_USER.get_secret_value()
        password = self.POSTGRES_PASSWORD.get_secret_value()
        db = self.POSTGRES_DB.get_secret_value()
        host = self.POSTGRES_HOST.get_secret_value()
        port = self.POSTGRES_PORT.get_secret_value()
        return SecretStr(f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}")

    # Redis
    REDIS_HOST: Annotated[SecretStr, Field(min_length=1)] = "localhost"
    REDIS_PORT: Annotated[SecretStr, Field(min_length=1)] = 6379

    @computed_field
    def REDIS_URL(self) -> SecretStr:
        host = self.REDIS_HOST.get_secret_value()
        port = self.REDIS_PORT.get_secret_value()
        return SecretStr(f"redis://{host}:{port}/0")

    # Security & JWT
    JWT_SECRET_KEY: Annotated[SecretStr, Field(min_length=32)]
    JWT_ALGORITHM: NonEmptyStr
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_REUSE_GRACE_SECONDS: int = 3
    DEFAULT_LANGUAGE_CODE: NonEmptyStr = "zh-TW"
    # Cookie flags: SameSite=None for cross-origin SPA; Secure off in development.
    COOKIE_SAMESITE: NonEmptyStr = "none"

    # LLM API
    OPENAI_API_KEY: SecretStr
    ANTHROPIC_API_KEY: SecretStr

    @property
    def cookie_secure(self) -> bool:
        """HttpOnly auth cookies use Secure except local/dev/test HTTP."""
        return self.APP_ENV not in {"development", "test"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
