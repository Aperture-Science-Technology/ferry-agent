"""Modeles SQLAlchemy 2.0 (async) pour Ferry Agent.

Les enums metier sont mappes vers des types ENUM natifs PostgreSQL via
`sqlalchemy.Enum(..., native_enum=True)` (comportement par defaut de
`sa.Enum` avec le dialecte postgresql) plutot que des colonnes texte + check
constraint : cela donne une validation au niveau DB et reste explicite dans
`\\d` / les migrations Alembic.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Enum as SAEnum
from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP

from ferry_agent.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class DeviceBrand(str, enum.Enum):
    kindle = "kindle"
    kobo = "kobo"
    tolino = "tolino"
    pocketbook = "pocketbook"
    other = "other"


class DeliveryTier(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class SourceType(str, enum.Enum):
    upload = "upload"
    gutenberg = "gutenberg"
    standard_ebooks = "standard_ebooks"
    opds = "opds"
    torrent_gateway = "torrent_gateway"


class DeliveryStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    delivered = "delivered"
    failed = "failed"


class DeliveryMethod(str, enum.Enum):
    email = "email"
    dropbox = "dropbox"
    drive = "drive"
    browser_code = "browser_code"
    usb = "usb"


class PairingStatus(str, enum.Enum):
    pending = "pending"
    paired = "paired"
    revoked = "revoked"


class GatewayJobType(str, enum.Enum):
    search = "search"
    fetch = "fetch"


class GatewayJobStatus(str, enum.Enum):
    pending = "pending"
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    kindle_email: Mapped[str | None] = mapped_column(String, nullable=True)
    default_format: Mapped[str] = mapped_column(String, default="epub", nullable=False)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    brand: Mapped[DeviceBrand] = mapped_column(SAEnum(DeviceBrand, name="device_brand"), nullable=False)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_tier: Mapped[DeliveryTier] = mapped_column(SAEnum(DeliveryTier, name="delivery_tier"), nullable=False)
    link_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    type: Mapped[SourceType] = mapped_column(SAEnum(SourceType, name="source_type"), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"), default=True)


class LibraryItem(Base):
    __tablename__ = "library_items"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    author: Mapped[str] = mapped_column(String, default="", nullable=False)
    cover_url: Mapped[str | None] = mapped_column(String, nullable=True)
    source_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("sources.id"), nullable=True)
    original_format: Mapped[str] = mapped_column(String, nullable=False)
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    added_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    isbn: Mapped[str | None] = mapped_column(String, nullable=True)
    publisher: Mapped[str | None] = mapped_column(String, nullable=True)
    published_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_ref: Mapped[str | None] = mapped_column(String, nullable=True)


class DeliveryJob(Base):
    __tablename__ = "delivery_jobs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    library_item_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("library_items.id"), nullable=False, index=True
    )
    device_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("devices.id"), nullable=False, index=True)
    status: Mapped[DeliveryStatus] = mapped_column(
        SAEnum(DeliveryStatus, name="delivery_status"), default=DeliveryStatus.queued, nullable=False
    )
    method: Mapped[DeliveryMethod] = mapped_column(SAEnum(DeliveryMethod, name="delivery_method"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)


class ShortCode(Base):
    """Code court de telechargement pour le mini-catalogue HTTP tier C."""

    __tablename__ = "short_codes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    code: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    delivery_job_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("delivery_jobs.id"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    downloads_left: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)


class Gateway(Base):
    __tablename__ = "gateways"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pairing_status: Mapped[PairingStatus] = mapped_column(
        SAEnum(PairingStatus, name="pairing_status"), default=PairingStatus.pending, nullable=False
    )
    api_key_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    pairing_token_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    pairing_expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    pairing_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)


class GatewayJob(Base):
    __tablename__ = "gateway_jobs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    gateway_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("gateways.id"), nullable=False, index=True)
    type: Mapped[GatewayJobType] = mapped_column(SAEnum(GatewayJobType, name="gateway_job_type"), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[GatewayJobStatus] = mapped_column(
        SAEnum(GatewayJobStatus, name="gateway_job_status"), default=GatewayJobStatus.pending, nullable=False
    )
    result_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
