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

    app_env: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
