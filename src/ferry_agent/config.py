from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://ferry:ferry@localhost:5432/ferry_agent"
    sql_echo: bool = False

    # Emetteur Clerk (ex: https://xxxx.clerk.accounts.dev). Si absent, l'API
    # tourne en mode dev : l'auth accepte le header X-Dev-User a la place
    # d'un JWT verifie. Ne jamais laisser vide en production.
    clerk_issuer: str | None = None
    clerk_audience: str | None = None

    library_storage_dir: str = "./data/library"
    temp_dir: str = "./data/tmp"

    max_fetch_bytes: int = 200 * 1024 * 1024
    pairing_token_ttl_minutes: int = 15
    gateway_online_seconds: int = 60
    gateway_search_wait_seconds: float = 15.0
    virustotal_api_key: str | None = None

    # Send-to-Kindle / envoi email (tier A). Laisser smtp_user/smtp_password
    # vides desactive l'envoi (mailer.is_configured() -> False) sans crash.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None

    # URL publique de base pour les liens courts du mini-catalogue tier C.
    public_base_url: str = "https://ferry-agent.aperture-agency.org"

    app_env: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
