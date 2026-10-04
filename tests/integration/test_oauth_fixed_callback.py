"""Régression F08 : retours OAuth fixes, avec stockage Postgres réel."""

import uuid
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from ferry_agent.api import devices
from ferry_agent.api.deps import get_current_user
from ferry_agent.config import Settings
from ferry_agent.main import app
from ferry_agent.models import Device
from ferry_agent.services import cloud_links, crypto


@pytest.fixture(autouse=True)
def oauth_settings(monkeypatch):
    settings = Settings(
        _env_file=None,
        fernet_key=Fernet.generate_key().decode(),
        dropbox_client_id="dbx-test",
        dropbox_client_secret="dbx-secret-test",
        google_client_id="google-test",
        google_client_secret="google-secret-test",
    )
    monkeypatch.setattr(devices, "get_settings", lambda: settings)
    monkeypatch.setattr(crypto, "get_settings", lambda: settings)
    crypto.clear_oauth_states()
    yield settings
    crypto.clear_oauth_states()


async def start(client, provider, *, legacy=False):
    response = await client.post(
        "/api/v1/devices", json={"brand": "kobo", "model": "Libra Colour"}
    )
    assert response.status_code == 201
    device_id = response.json()["id"]
    path = f"/api/v1/devices/{device_id}/link" if legacy else "/api/v1/devices/link/start"
    response = await client.get(
        path, params={"device_id": device_id, "provider": provider, "locale": "en"}
    )
    assert response.status_code == 200
    return uuid.UUID(device_id), parse_qs(urlsplit(response.json()["url"]).query)


def forbid_auth():
    """Le retour navigateur doit fonctionner sans authentification Clerk."""
    raise HTTPException(status_code=401, detail="Authentification absente")


@pytest.mark.parametrize("provider,segment", [("dropbox", "dropbox"), ("drive", "google")])
@pytest.mark.parametrize("legacy", [False, True])
async def test_fixed_callback_links_device(client, db_session, monkeypatch, provider, segment, legacy):
    device_id, query = await start(client, provider, legacy=legacy)
    expected = f"https://ferry-agent.aperture-agency.org/api/v1/devices/link/callback/{segment}"
    assert query["redirect_uri"] == [expected]
    assert "{id}" not in query["redirect_uri"][0]
    if provider == "drive":
        assert query["scope"] == [cloud_links.GOOGLE_DRIVE_SCOPE]
    else:
        assert "scope" not in query

    async def exchange(code, client_id, client_secret, redirect_uri):
        assert code == "code-test"
        assert redirect_uri == query["redirect_uri"][0]
        return {"access_token": "jeton-test", "refresh_token": "renouvellement-test"}

    monkeypatch.setattr(cloud_links, f"exchange_{provider}_code", exchange)
    app.dependency_overrides[get_current_user] = forbid_auth
    response = await client.get(
        f"/api/v1/devices/link/callback/{segment}",
        params={"code": "code-test", "state": query["state"][0]},
    )
    assert response.status_code == 302
    assert response.headers["location"].endswith("/en/app/appareils?cloud_link=ok")
    db_session.expire_all()
    device = await db_session.get(Device, device_id)
    assert cloud_links.parse_link_ref(device.link_ref)["provider"] == provider
    assert "jeton-test" not in device.link_ref
    stored = device.link_ref

    async def unexpected_exchange(*args):
        pytest.fail("Un retour déjà consommé ne doit pas être échangé à nouveau")

    monkeypatch.setattr(cloud_links, f"exchange_{provider}_code", unexpected_exchange)
    replay = await client.get(
        f"/api/v1/devices/link/callback/{segment}",
        params={"code": "autre-code", "state": query["state"][0]},
    )
    assert replay.status_code == 302
    assert replay.headers["location"].endswith("cloud_link=error")
    db_session.expire_all()
    device = await db_session.get(Device, device_id)
    assert device.link_ref == stored


@pytest.mark.parametrize(
    "scenario",
    ["altered", "expired", "replayed", "wrong_provider", "deleted", "missing", "denied", "exchange_error"],
)
async def test_fixed_callback_rejects_without_linking(client, db_session, monkeypatch, scenario):
    device_id, query = await start(client, "dropbox", legacy=True)
    state = query["state"][0]
    segment = "dropbox"
    params = {"code": "code-test", "state": state}
    if scenario == "altered":
        params["state"] = state[:20] + ("A" if state[20] != "A" else "B") + state[21:]
    elif scenario == "expired":
        now = crypto.time.time()
        monkeypatch.setattr(crypto.time, "time", lambda: now + 601)
    elif scenario == "replayed":
        crypto.consume_oauth_state(state, device_id)
    elif scenario == "wrong_provider":
        segment = "google"
    elif scenario == "deleted":
        response = await client.delete(f"/api/v1/devices/{device_id}")
        assert response.status_code == 204
    elif scenario == "missing":
        del params["state"]
    elif scenario == "denied":
        params = {"state": state, "error": "access_denied"}

    async def exchange(*args):
        if scenario == "exchange_error":
            raise cloud_links.CloudLinkError("Échange refusé")
        pytest.fail("Aucun échange ne doit avoir lieu pour un retour refusé")

    monkeypatch.setattr(cloud_links, "exchange_dropbox_code", exchange)
    monkeypatch.setattr(cloud_links, "exchange_drive_code", exchange)
    app.dependency_overrides[get_current_user] = forbid_auth
    response = await client.get(f"/api/v1/devices/link/callback/{segment}", params=params)
    assert response.status_code == 302
    assert response.headers["location"].endswith("/app/appareils?cloud_link=error")
    db_session.expire_all()
    device = await db_session.get(Device, device_id)
    if scenario == "deleted":
        assert device is None
    else:
        assert device.link_ref is None
    if scenario in {"denied", "wrong_provider", "exchange_error"}:
        with pytest.raises(crypto.CryptoError):
            crypto.consume_oauth_state(state, device_id)


@pytest.mark.parametrize("provider", ["dropbox", "drive"])
@pytest.mark.parametrize("method", ["get", "post"])
async def test_legacy_callback_and_redirect_template(client, db_session, monkeypatch, oauth_settings, provider, method):
    template = "https://ferry.example.test/api/v1/devices/{id}/link/callback"
    attribute = "dropbox_redirect_uri" if provider == "dropbox" else "google_redirect_uri"
    setattr(oauth_settings, attribute, template)
    device_id, query = await start(client, provider, legacy=True)
    assert query["redirect_uri"] == [template.format(id=device_id)]

    async def exchange(code, client_id, client_secret, redirect_uri):
        assert redirect_uri == query["redirect_uri"][0]
        return {"access_token": "jeton", "refresh_token": "renouvellement"}

    monkeypatch.setattr(cloud_links, f"exchange_{provider}_code", exchange)
    path = f"/api/v1/devices/{device_id}/link/callback"
    if method == "get":
        app.dependency_overrides[get_current_user] = forbid_auth
        response = await client.get(path, params={"code": "code", "state": query["state"][0]})
        assert response.status_code == 302
        assert response.headers["location"].endswith("cloud_link=ok")
    else:
        response = await client.post(path, json={"provider": provider, "code": "code"})
        assert response.status_code == 200
        assert response.json()["cloud_linked"] is True
    db_session.expire_all()
    device = await db_session.get(Device, device_id)
    assert cloud_links.parse_link_ref(device.link_ref)["provider"] == provider
