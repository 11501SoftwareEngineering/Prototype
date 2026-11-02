"""Local non-secret app config loaded from ``backend/config.yaml``."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

BACKEND_DIR = Path(__file__).resolve().parents[2]
CONFIG_YAML_PATH = BACKEND_DIR / "config.yaml"


class YamlConfig(BaseModel):
    """Fields sourced from ``config.yaml``"""

    # Super-admin via account_id list (login /users/me still returns role as USER|TEACHER)
    SUPER_ADMIN_ACCOUNTS: list[str] = Field(default_factory=list)


@lru_cache
def get_yaml_config() -> YamlConfig:
    """Load ``config.yaml`` if present; otherwise empty defaults."""
    if not CONFIG_YAML_PATH.is_file():
        return YamlConfig()
    raw = yaml.safe_load(CONFIG_YAML_PATH.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        msg = f"{CONFIG_YAML_PATH.name} must be a mapping"
        raise ValueError(msg)
    return YamlConfig.model_validate(raw)


yaml_config = get_yaml_config()
