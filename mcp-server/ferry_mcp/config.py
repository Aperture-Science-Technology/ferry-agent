"""Configuration du serveur MCP Ferry Agent."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ferry_core_url: str = "http://ferry-core:8000"
    port: int = 8000
    mcp_auth_enabled: bool = True
    clerk_domain: str = ""
    clerk_oauth_client_id: str = ""
    clerk_oauth_client_secret: str = ""
    mcp_base_url: str = "https://ferry-agent.aperture-agency.org"
    # Clé dédiée pour signer les JWT FastMCP (clients MCP). Si absente, FastMCP
    # dérive encore de CLERK_OAUTH_CLIENT_SECRET (comportement historique).
    mcp_jwt_signing_key: str = ""
    # Clé privée Ed25519 (PEM base64 une ligne) pour forger l'assertion cœur.
    # Absente → repli sur le relais du jeton Clerk amont (avertissement log).
    mcp_core_assertion_private_key_b64: str = ""
    # Origines CORS autorisées (CSV). "*" = toutes, sans credentials.
    mcp_allowed_origins: str = "*"
    app_env: str = "development"

    @model_validator(mode="after")
    def _refuse_auth_disabled_in_production(self) -> "MCPSettings":
        if self.app_env == "production" and not self.mcp_auth_enabled:
            raise ValueError(
                "MCP_AUTH_ENABLED=false est interdit lorsque APP_ENV=production : "
                "l'identité Clerk utilisateur est obligatoire."
            )
        return self


@lru_cache
def get_settings() -> MCPSettings:
    return MCPSettings()
