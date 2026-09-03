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


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, execute_values=()):
        self.execute_values = list(execute_values)
        self.commits = 0

    async def execute(self, statement):
        value = self.execute_values.pop(0) if self.execute_values else None
        return ScalarResult(value)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _value):
        return None


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
    assert out.link_ref == device.link_ref


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
    assert out.link_ref == device.link_ref


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
