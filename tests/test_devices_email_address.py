"""Verifie la migration 0017 (Device.email_address) et la lecture du champ modele."""

from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path
from unittest.mock import patch

from ferry_agent.models import Device, DeviceBrand, DeliveryTier

_MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0017_device_email_address.py"
)
_spec = importlib.util.spec_from_file_location("migration_0017_device_email_address", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)  # type: ignore[union-attr]


def test_revision_chain() -> None:
    assert migration.revision == "0017_device_email_address"
    assert migration.down_revision == "0016_delivery_attempts"


def test_upgrade_adds_email_address_column() -> None:
    added: list[tuple[str, object]] = []

    def fake_add_column(table, column):
        added.append((table, column))

    with patch.object(migration.op, "add_column", side_effect=fake_add_column):
        migration.upgrade()

    assert len(added) == 1
    table, column = added[0]
    assert table == "devices"
    assert column.name == "email_address"
    assert column.nullable is True


def test_downgrade_drops_email_address_column() -> None:
    dropped: list[tuple[str, str]] = []

    def fake_drop_column(table, column):
        dropped.append((table, column))

    with patch.object(migration.op, "drop_column", side_effect=fake_drop_column):
        migration.downgrade()

    assert dropped == [("devices", "email_address")]


def test_device_email_address_readable() -> None:
    device = Device(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        brand=DeviceBrand.kindle,
        delivery_tier=DeliveryTier.A,
        email_address="paperwhite@kindle.com",
    )
    assert device.email_address == "paperwhite@kindle.com"


def test_device_email_address_defaults_to_none() -> None:
    device = Device(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        brand=DeviceBrand.kindle,
        delivery_tier=DeliveryTier.A,
    )
    assert device.email_address is None
