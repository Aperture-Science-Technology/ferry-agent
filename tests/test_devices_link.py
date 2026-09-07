"""Tests du linking OAuth cloud (tier B) sur /api/v1/devices, sans DB reelle
ni appel reseau reel (fastapi.HTTPException attendues + cloud_links mocke)."""

import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from ferry_agent.api import devices
from ferry_agent.api.deps import CurrentUser
from ferry_agent.models import Device, DeviceBrand, DeliveryTier
from ferry_agent.schemas import DeviceLinkCallback
from ferry_agent.services import cloud_links

from tests.fakes import FakeSession


def make_device(**overrides) -> Device:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "brand": DeviceBrand.kobo,
        "delivery_tier": DeliveryTier.B,
        "link_ref": None,
    }
    values.update(overrides)
    return Device(**values)


def fake_settings(**overrides):
    values = {
        "dropbox_client_id": "dbx-cid",
        "dropbox_client_secret": "dbx-secret",
        "dropbox_redirect_uri": "https://ferry.example.test/api/v1/devices/{id}/link/callback",
        "google_client_id": "goog-cid",
        "google_client_secret": "goog-secret",
        "google_redirect_uri": "https://ferry.example.test/api/v1/devices/{id}/link/callback",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


async def test_get_link_url_builds_dropbox_authorize_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(devices, "get_settings", fake_settings)
    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.get_link_url(device.id, "dropbox", user, db)

    assert out.url.startswith("https://www.dropbox.com/oauth2/authorize?")
    assert "client_id=dbx-cid" in out.url
    assert "token_access_type=offline" in out.url


async def test_get_link_url_builds_drive_authorize_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(devices, "get_settings", fake_settings)
    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.get_link_url(device.id, "drive", user, db)

    assert out.url.startswith("https://accounts.google.com/o/oauth2/auth?")
    assert "client_id=goog-cid" in out.url
    assert "scope=" in out.url


async def test_get_link_url_rejects_unknown_provider() -> None:
    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    with pytest.raises(HTTPException) as exc_info:
        await devices.get_link_url(device.id, "icloud", user, db)
    assert exc_info.value.status_code == 400


async def test_get_link_url_404_for_other_users_device() -> None:
    device = make_device()
    other_user = CurrentUser(id=uuid.uuid4(), email="other@example.test")
    db = FakeSession([None])  # requete filtree par user_id -> rien trouve

    with pytest.raises(HTTPException) as exc_info:
        await devices.get_link_url(device.id, "dropbox", other_user, db)
    assert exc_info.value.status_code == 404


async def test_get_link_url_503_when_dropbox_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(devices, "get_settings", lambda: fake_settings(dropbox_client_id=None))
    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    with pytest.raises(HTTPException) as exc_info:
        await devices.get_link_url(device.id, "dropbox", user, db)
    assert exc_info.value.status_code == 503


async def test_link_callback_stores_dropbox_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(devices, "get_settings", fake_settings)

    async def fake_exchange_dropbox_code(code, client_id, client_secret, redirect_uri):
        assert code == "auth-code"
        assert client_id == "dbx-cid"
        assert client_secret == "dbx-secret"
        return {"access_token": "dbx-access-tok", "refresh_token": "dbx-refresh"}

    monkeypatch.setattr(cloud_links, "exchange_dropbox_code", fake_exchange_dropbox_code)

    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.link_callback(
        device.id, DeviceLinkCallback(provider="dropbox", code="auth-code"), user, db
    )

    assert json.loads(device.link_ref) == {"provider": "dropbox", "token": "dbx-access-tok"}
    assert out.cloud_linked is True
    assert out.cloud_provider == "dropbox"
    assert "dbx-access-tok" not in out.model_dump_json()


async def test_link_callback_stores_drive_refresh_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(devices, "get_settings", fake_settings)

    async def fake_exchange_drive_code(code, client_id, client_secret, redirect_uri):
        assert code == "auth-code"
        return {"access_token": "goog-access-tok", "refresh_token": "goog-refresh"}

    monkeypatch.setattr(cloud_links, "exchange_drive_code", fake_exchange_drive_code)

    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.link_callback(
        device.id, DeviceLinkCallback(provider="drive", code="auth-code"), user, db
    )

    assert json.loads(device.link_ref) == {"provider": "drive", "refresh_token": "goog-refresh"}
    assert out.cloud_linked is True
    assert out.cloud_provider == "drive"
    assert "goog-refresh" not in out.model_dump_json()


def test_get_devices_http_does_not_leak_dropbox_token() -> None:
    """GET /api/v1/devices : le corps brut ne doit contenir nulle part le token."""
    from unittest.mock import AsyncMock, MagicMock

    from fastapi.testclient import TestClient

    from ferry_agent.main import app
    from tests.fakes import clear_app_deps, override_app_deps

    token_value = "sl.BxxxxxxxxSECRETTOK"
    device = make_device(
        name="Ma Kobo",
        link_ref=json.dumps({"provider": "dropbox", "token": token_value}),
    )

    async def fake_db():
        db = AsyncMock()

        class FakeResult:
            def scalars(self):
                return MagicMock(all=MagicMock(return_value=[device]))

        db.execute = AsyncMock(return_value=FakeResult())
        yield db

    override_app_deps(fake_db, user_id=device.user_id, email="reader@example.test")
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/devices")
        assert response.status_code == 200
        assert token_value not in response.text
        assert "sl.B" not in response.text
        assert "link_ref" not in response.text
        data = response.json()
        assert data[0]["cloud_linked"] is True
        assert data[0]["cloud_provider"] == "dropbox"
    finally:
        clear_app_deps()


async def test_list_devices_unlinked_reports_not_linked() -> None:
    device = make_device(link_ref=None)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([[device]])

    out = await devices.list_devices(user, db)

    assert out[0].cloud_linked is False
    assert out[0].cloud_provider is None


async def test_link_callback_502_on_exchange_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(devices, "get_settings", fake_settings)

    async def raising_exchange(*_args, **_kwargs):
        raise cloud_links.CloudLinkError("echange de code Dropbox echoue (400): invalid_grant")

    monkeypatch.setattr(cloud_links, "exchange_dropbox_code", raising_exchange)

    device = make_device()
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    with pytest.raises(HTTPException) as exc_info:
        await devices.link_callback(
            device.id, DeviceLinkCallback(provider="dropbox", code="bad-code"), user, db
        )
    assert exc_info.value.status_code == 502
