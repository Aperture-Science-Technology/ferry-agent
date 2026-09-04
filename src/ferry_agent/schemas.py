import uuid
from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, RootModel

from ferry_agent.models import (
    DeliveryMethod,
    DeliveryStatus,
    DeviceBrand,
    DeliveryTier,
    GatewayJobStatus,
    GatewayJobType,
    PairingStatus,
)


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


class ResultOut(Result):
    pass


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


class LibraryItemUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    description: str | None = None
    language: str | None = None
    page_count: int | None = None
    publisher: str | None = None
    published_year: int | None = None
    isbn: str | None = None


class DeviceCreate(BaseModel):
    brand: DeviceBrand
    model: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    kindle_email: str | None
    default_format: str


class UserPatch(BaseModel):
    kindle_email: str | None = None
    default_format: str | None = None


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    created_at: datetime


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand: DeviceBrand
    model: str | None
    delivery_tier: DeliveryTier
    link_ref: str | None
    last_synced_at: datetime | None


class DeviceLinkUrlOut(BaseModel):
    url: str


class DeviceLinkCallback(BaseModel):
    provider: str
    code: str = Field(min_length=1)


class DeliveryCreate(BaseModel):
    library_item_id: uuid.UUID
    device_id: uuid.UUID
    format: str | None = None
    method: DeliveryMethod = DeliveryMethod.email


class DeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    library_item_id: uuid.UUID
    device_id: uuid.UUID
    status: DeliveryStatus
    method: DeliveryMethod
    created_at: datetime
    delivered_at: datetime | None
    error: str | None
    download_url: str | None = None
