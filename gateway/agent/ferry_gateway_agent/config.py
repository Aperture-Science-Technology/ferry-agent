from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    platform_url: str = Field(
        default="https://ferry-agent.aperture-agency.org",
        alias="PLATFORM_URL",
    )
    pairing_token: str | None = Field(default=None, alias="PAIRING_TOKEN")
    gateway_id: str | None = Field(default=None, alias="GATEWAY_ID")
    gateway_key: str | None = Field(default=None, alias="GATEWAY_KEY")

    prowlarr_url: str = Field(default="http://prowlarr:9696", alias="PROWLARR_URL")
    prowlarr_api_key: str = Field(default="", alias="PROWLARR_API_KEY")

    transmission_url: str = Field(
        default="http://transmission:9091",
        alias="TRANSMISSION_URL",
    )
    transmission_user: str | None = Field(default=None, alias="TRANSMISSION_USER")
    transmission_password: str | None = Field(
        default=None,
        alias="TRANSMISSION_PASSWORD",
    )

    download_path: Path = Field(default=Path("/downloads"), alias="DOWNLOAD_PATH")
    download_timeout_minutes: float = Field(
        default=15,
        gt=0,
        alias="DOWNLOAD_TIMEOUT_MINUTES",
    )
    poll_interval_seconds: float = Field(
        default=10,
        gt=0,
        alias="POLL_INTERVAL_SECONDS",
    )
    transmission_poll_seconds: float = Field(
        default=2,
        gt=0,
        alias="TRANSMISSION_POLL_SECONDS",
    )
    virustotal_api_key: str | None = Field(
        default=None,
        alias="VIRUSTOTAL_API_KEY",
    )
    state_path: Path = Field(default=Path("/state/state.json"), alias="STATE_PATH")

    @field_validator(
        "pairing_token",
        "gateway_id",
        "gateway_key",
        "transmission_user",
        "transmission_password",
        "virustotal_api_key",
        mode="before",
    )
    @classmethod
    def empty_string_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("platform_url", "prowlarr_url", "transmission_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @model_validator(mode="after")
    def transmission_credentials_are_complete(self) -> "Settings":
        if bool(self.transmission_user) != bool(self.transmission_password):
            raise ValueError(
                "TRANSMISSION_USER and TRANSMISSION_PASSWORD must be set together"
            )
        return self
