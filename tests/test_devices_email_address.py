"""Verifie la migration 0017 (Device.email_address), le modele, et l'API create/patch."""

from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from ferry_agent.main import app
from ferry_agent.models import Device, DeviceBrand, DeliveryTier
from ferry_agent.services import mail_policy
from tests.fakes import FakeSession, clear_app_deps, override_app_deps

_MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0017_device_email_address.py"
)
_spec = importlib.util.spec_from_file_location("migration_0017_device_email_address", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)  # type: ignore[union-attr]

_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"
_ALLOWED_MSG = str(mail_policy.RecipientNotAllowed())


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


def _create_db_with_capture(created: list):
    async def fake_db():
        db = AsyncMock()

        def fake_add(obj):
            obj.id = uuid.uuid4()
            obj.last_synced_at = None
            obj.link_ref = None
            created.append(obj)

        db.add = MagicMock(side_effect=fake_add)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        yield db

    return fake_db


def test_create_device_accepts_kindle_email_address() -> None:
    created: list = []
    override_app_deps(_create_db_with_capture(created), user_id=_USER_ID, email=_USER_EMAIL)
    try:
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/devices",
                json={"brand": "kindle", "model": "Paperwhite", "email_address": "pw@kindle.com"},
            )
        assert resp.status_code == 201
        assert resp.json()["email_address"] == "pw@kindle.com"
        assert created[0].email_address == "pw@kindle.com"
    finally:
        clear_app_deps()


def test_create_device_rejects_gmail_address() -> None:
    created: list = []
    override_app_deps(_create_db_with_capture(created), user_id=_USER_ID, email=_USER_EMAIL)
    try:
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/devices",
                json={"brand": "kindle", "email_address": "reader@gmail.com"},
            )
        assert resp.status_code == 400
        assert resp.json()["detail"] == _ALLOWED_MSG
        assert not created
    finally:
        clear_app_deps()


def test_patch_device_accepts_kindle_email_address() -> None:
    device = Device(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        brand=DeviceBrand.kindle,
        delivery_tier=DeliveryTier.A,
        name=None,
        model=None,
        email_address=None,
        link_ref=None,
        last_synced_at=None,
    )

    async def fake_db():
        yield FakeSession([device])

    override_app_deps(fake_db, user_id=_USER_ID, email=_USER_EMAIL)
    try:
        with TestClient(app) as client:
            resp = client.patch(
                f"/api/v1/devices/{device.id}",
                json={"email_address": "device@kindle.fr"},
            )
        assert resp.status_code == 200
        assert resp.json()["email_address"] == "device@kindle.fr"
        assert device.email_address == "device@kindle.fr"
    finally:
        clear_app_deps()


def test_patch_device_rejects_gmail_address() -> None:
    device = Device(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        brand=DeviceBrand.kindle,
        delivery_tier=DeliveryTier.A,
        email_address="ok@kindle.com",
        link_ref=None,
        last_synced_at=None,
    )

    async def fake_db():
        yield FakeSession([device])

    override_app_deps(fake_db, user_id=_USER_ID, email=_USER_EMAIL)
    try:
        with TestClient(app) as client:
            resp = client.patch(
                f"/api/v1/devices/{device.id}",
                json={"email_address": "reader@gmail.com"},
            )
        assert resp.status_code == 400
        assert resp.json()["detail"] == _ALLOWED_MSG
        assert device.email_address == "ok@kindle.com"
    finally:
        clear_app_deps()


def test_patch_device_empty_string_clears_email_address() -> None:
    device = Device(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        brand=DeviceBrand.kindle,
        delivery_tier=DeliveryTier.A,
        email_address="ok@kindle.com",
        link_ref=None,
        last_synced_at=None,
    )

    async def fake_db():
        yield FakeSession([device])

    override_app_deps(fake_db, user_id=_USER_ID, email=_USER_EMAIL)
    try:
        with TestClient(app) as client:
            resp = client.patch(
                f"/api/v1/devices/{device.id}",
                json={"email_address": ""},
            )
        assert resp.status_code == 200
        assert resp.json()["email_address"] is None
        assert device.email_address is None
    finally:
        clear_app_deps()
