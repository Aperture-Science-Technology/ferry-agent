"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-03

Cree toutes les tables du modele de donnees M0 : users, devices, sources,
library_items, delivery_jobs, gateways, gateway_jobs. Ecrite a la main
(plutot qu'autogeneree) car aucune base Postgres n'est disponible dans cet
environnement de developpement ; elle reflete exactement `models.py`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("kindle_email", sa.String(), nullable=True),
        sa.Column("default_format", sa.String(), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "devices",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "brand",
            sa.Enum("kindle", "kobo", "tolino", "pocketbook", "other", name="device_brand"),
            nullable=False,
        ),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("delivery_tier", sa.Enum("A", "B", "C", "D", name="delivery_tier"), nullable=False),
        sa.Column("link_ref", sa.String(), nullable=True),
        sa.Column("last_synced_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])

    op.create_table(
        "sources",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "type",
            sa.Enum("upload", "gutenberg", "standard_ebooks", "opds", name="source_type"),
            nullable=False,
        ),
        sa.Column("config", pg.JSONB(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("ix_sources_user_id", "sources", ["user_id"])

    op.create_table(
        "library_items",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("author", sa.String(), nullable=False),
        sa.Column("cover_url", sa.String(), nullable=True),
        sa.Column("source_id", pg.UUID(as_uuid=True), sa.ForeignKey("sources.id"), nullable=True),
        sa.Column("original_format", sa.String(), nullable=False),
        sa.Column("added_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("ix_library_items_user_id", "library_items", ["user_id"])

    op.create_table(
        "delivery_jobs",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "library_item_id", pg.UUID(as_uuid=True), sa.ForeignKey("library_items.id"), nullable=False
        ),
        sa.Column("device_id", pg.UUID(as_uuid=True), sa.ForeignKey("devices.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("queued", "sent", "delivered", "failed", name="delivery_status"),
            nullable=False,
        ),
        sa.Column(
            "method",
            sa.Enum("email", "dropbox", "browser_code", "usb", name="delivery_method"),
            nullable=False,
        ),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
    )
    op.create_index("ix_delivery_jobs_library_item_id", "delivery_jobs", ["library_item_id"])
    op.create_index("ix_delivery_jobs_device_id", "delivery_jobs", ["device_id"])

    op.create_table(
        "gateways",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "pairing_status",
            sa.Enum("pending", "paired", name="pairing_status"),
            nullable=False,
        ),
        sa.Column("api_key_hash", sa.String(), nullable=True),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("ix_gateways_user_id", "gateways", ["user_id"])

    op.create_table(
        "gateway_jobs",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("gateway_id", pg.UUID(as_uuid=True), sa.ForeignKey("gateways.id"), nullable=False),
        sa.Column(
            "type",
            sa.Enum("search", "fetch", name="gateway_job_type"),
            nullable=False,
        ),
        sa.Column("payload", pg.JSONB(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "queued", "running", "done", "failed", name="gateway_job_status"),
            nullable=False,
        ),
        sa.Column("result_ref", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("ix_gateway_jobs_gateway_id", "gateway_jobs", ["gateway_id"])


def downgrade() -> None:
    op.drop_table("gateway_jobs")
    op.drop_table("gateways")
    op.drop_table("delivery_jobs")
    op.drop_table("library_items")
    op.drop_table("sources")
    op.drop_table("devices")
    op.drop_table("users")

    sa.Enum(name="gateway_job_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="gateway_job_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="pairing_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_method").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="source_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_tier").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="device_brand").drop(op.get_bind(), checkfirst=True)
