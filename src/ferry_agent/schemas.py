import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ferry_agent.models import DeliveryMethod, DeliveryStatus, DeviceBrand, DeliveryTier


class SearchRequest(BaseModel):
    query: str


class ResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source: str
    title: str
    result_id: str
    author: str = ""
    format: str = "epub"
    size_bytes: int = 0


class LibraryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    author: str
    cover_url: str | None
    source_id: uuid.UUID | None
    original_format: str
    added_at: datetime


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand: DeviceBrand
    model: str | None
    delivery_tier: DeliveryTier
    link_ref: str | None
    last_synced_at: datetime | None


class DeliveryCreate(BaseModel):
    library_item_id: uuid.UUID
    device_id: uuid.UUID
    format: str
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
