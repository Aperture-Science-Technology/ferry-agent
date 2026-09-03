"""Configuration du serveur MCP Ferry Agent."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ferry_core_url: str = "http://ferry-core:8000"
    mcp_api_key: str = ""
    port: int = 8000
    mcp_auth_enabled: bool = False
    clerk_domain: str = ""
    clerk_oauth_client_id: str = ""
    clerk_oauth_client_secret: str = ""
    mcp_base_url: str = "https://ferry-agent.aperture-agency.org"


@lru_cache
def get_settings() -> MCPSettings:
    return MCPSettings()
