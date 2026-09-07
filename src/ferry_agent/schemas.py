import uuid
from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, RootModel

from ferry_agent.models import (
    DeliveryMethod,
    DeliveryStatus,
    DeviceBrand,
    DeliveryTier,
    GatewayJobStatus,
    GatewayJobType,
    PairingStatus,
)

# W-27 : presets de conversion (pas de reglage fin en v1).
ConversionPreset = Literal["reader_6in", "reader_7in_plus", "tablet"]


class SearchRequest(BaseModel):
    query: str
    scope: list[str] | None = None


class Result(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source: str
    title: str
    result_id: str
    author: str = ""
    format: str = "epub"
    size_bytes: int = 0
    magnet_url: str | None = None
    indexer_id: int | str | None = None
    guid: str | None = None
    seeders: int | None = None
    isbn: str | None = None


class ResultOut(Result):
    cover_url: str | None = None
    language: str | None = None
    description: str | None = None
    page_count: int | None = None
    owned: bool = False


class SearchResults(RootModel[list[Result]]):
    """Liste JSON nue acceptee depuis le gateway-agent."""


class GatewayCreate(BaseModel):
    name: str = Field(default="Gateway", min_length=1, max_length=120)


class GatewayCredentials(BaseModel):
    gateway_id: uuid.UUID
    pairing_token: str
    gateway_key: str


class GatewayPair(BaseModel):
    token: str = Field(
        min_length=16,
        validation_alias=AliasChoices("pairing_token", "token"),
    )


class GatewayId(BaseModel):
    gateway_id: uuid.UUID


class GatewayRevoke(BaseModel):
    gateway_id: uuid.UUID


class GatewayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gateway_id: uuid.UUID = Field(validation_alias="id")
    name: str
    status: PairingStatus = Field(validation_alias="pairing_status")
    last_seen_at: datetime | None


class GatewayJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: uuid.UUID = Field(validation_alias="id")
    type: GatewayJobType
    payload: dict
    status: GatewayJobStatus


class GatewayJobStatusOut(GatewayJobOut):
    attempts: int = 0
    library_item_id: uuid.UUID | None = None
    error: str | None = None


class GatewayJobAck(BaseModel):
    job_id: uuid.UUID
    status: GatewayJobStatus


class GatewayFetchQueued(BaseModel):
    gateway_job_id: uuid.UUID
    status: GatewayJobStatus


class GatewayFetchResult(BaseModel):
    library_item_id: uuid.UUID


class LibraryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    author: str
    cover_url: str | None
    source_id: uuid.UUID | None
    original_format: str
    added_at: datetime
    description: str | None = None
    language: str | None = None
    page_count: int | None = None
    size_bytes: int | None = None
    isbn: str | None = None
    publisher: str | None = None
    published_year: int | None = None
    source_ref: str | None = None


class LibraryItemUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    description: str | None = None
    language: str | None = None
    page_count: int | None = None
    publisher: str | None = None
    published_year: int | None = None
    isbn: str | None = None


class PaginatedLibraryItems(BaseModel):
    items: list[LibraryItemOut]
    total: int
    page: int
    limit: int


class OpdsTokenCreate(BaseModel):
    label: str = Field(default="Liseuse", min_length=1, max_length=120)


class OpdsTokenCreated(BaseModel):
    id: uuid.UUID
    label: str
    token: str
    url: str
    created_at: datetime


class OpdsTokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    created_at: datetime
    last_used_at: datetime | None


class OpdsTokenRevoke(BaseModel):
    token_id: uuid.UUID


class DeviceCreate(BaseModel):
    """Pas de `delivery_tier` ici : le tier est toujours calcule cote serveur
    depuis `brand`/`model` (voir `api.devices._compute_tier`), jamais choisi
    a la main par le client (extra fields ignores par defaut par pydantic)."""

    name: str | None = None
    brand: DeviceBrand
    model: str | None = None
    conversion_profile: ConversionPreset | None = None


class DevicePatch(BaseModel):
    name: str | None = None
    brand: DeviceBrand | None = None
    model: str | None = None
    conversion_profile: ConversionPreset | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    kindle_email: str | None
    default_format: str


class UserPatch(BaseModel):
    kindle_email: EmailStr | None = None
    default_format: Literal["epub", "mobi", "azw3", "pdf"] | None = None


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    created_at: datetime
    enabled: bool


class SourceUpdate(BaseModel):
    enabled: bool


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None
    brand: DeviceBrand
    model: str | None
    delivery_tier: DeliveryTier
    conversion_profile: ConversionPreset | None = None
    cloud_provider: Literal["dropbox", "drive"] | None = None
    cloud_linked: bool = False
    last_synced_at: datetime | None


class DeviceLinkUrlOut(BaseModel):
    url: str


class DeviceLinkCallback(BaseModel):
    provider: str
    code: str = Field(min_length=1)


class DeliveryCreate(BaseModel):
    library_item_id: uuid.UUID
    device_id: uuid.UUID
    format: Literal["epub", "mobi", "azw3", "pdf"] | None = None
    # Le frontend envoie desormais `method` explicitement (voir
    # `GET /api/v1/devices/{id}/methods` pour les modes reellement
    # disponibles pour le device cible). Le defaut `email` n'est qu'un
    # filet de compatibilite pour un vieux client qui omettrait le champ ;
    # l'API valide dans tous les cas que `method` correspond a un mode
    # disponible pour le device (voir `create_delivery`), donc ce defaut ne
    # peut plus faire retomber silencieusement sur un envoi email errone.
    method: DeliveryMethod = DeliveryMethod.email


class DeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    library_item_id: uuid.UUID | None = None
    device_id: uuid.UUID
    status: DeliveryStatus
    method: DeliveryMethod
    created_at: datetime
    delivered_at: datetime | None
    error: str | None
    download_url: str | None = None
    # Enrichis pour l'UI (jointure LibraryItem / Device, avec repli sur les
    # colonnes denormalisees de DeliveryJob si le livre a ete supprime).
    item_title: str | None = None
    item_author: str | None = None
    device_label: str | None = None
