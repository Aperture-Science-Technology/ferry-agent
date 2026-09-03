"""Configuration du serveur MCP Ferry Agent."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ferry_core_url: str = "http://ferry-core:8000"
    mcp_api_key: str = ""
    port: int = 8000


@lru_cache
def get_settings() -> MCPSettings:
    return MCPSettings()
