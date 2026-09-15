"""FA-FUNC-DEVICES-CLOUD-01 : chiffrement au repos de link_ref + etats lie/non lie.

Postgres reel : le token stocke ne doit jamais apparaitre en clair dans
`devices.link_ref`, et l'API degrade en `cloud_linked=false` si le jeton
est illisible (cle perdue / corruption).
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import text

from ferry_agent.models import Device
from ferry_agent.services import cloud_links, crypto


TEST_FERNET_KEY = Fernet.generate_key().decode()
FOREIGN_FERNET_KEY = Fernet.generate_key().decode()


def _settings(**overrides):
    values = {
        "dropbox_client_id": "dbx-cid",
        "dropbox_client_secret": "dbx-secret",
        "dropbox_redirect_uri": "https://ferry.example.test/api/v1/devices/{id}/link/callback",
        "google_client_id": "goog-cid",
        "google_client_secret": "goog-secret",
        "google_redirect_uri": "https://ferry.example.test/api/v1/devices/{id}/link/callback",
        "fernet_key": TEST_FERNET_KEY,
        "oauth_state_ttl_seconds": 600,
        "public_base_url": "https://ferry.example.test",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture(autouse=True)
def _fernet_and_oauth(monkeypatch: pytest.MonkeyPatch):
    crypto.clear_oauth_states()
    settings = _settings()

    def fake_settings():
        return settings

    monkeypatch.setattr("ferry_agent.api.devices.get_settings", fake_settings)
    monkeypatch.setattr("ferry_agent.services.crypto.get_settings", fake_settings)
    monkeypatch.setattr("ferry_agent.config.get_settings", fake_settings)
    yield
    crypto.clear_oauth_states()


async def test_link_ref_encrypted_in_postgres_and_exposed_as_linked(
    client, db_session, monkeypatch: pytest.MonkeyPatch
) -> None:
    token_value = "sl.BxxxxxxxxSECRETTOK-integration"

    async def fake_exchange(code, client_id, client_secret, redirect_uri):
        assert code == "auth-code"
        return {"access_token": token_value}

    monkeypatch.setattr(cloud_links, "exchange_dropbox_code", fake_exchange)

    create = await client.post(
        "/api/v1/devices",
        json={"brand": "kobo", "model": "Libra Colour", "name": "Kobo cloud"},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["delivery_tier"] == "B"
    assert body["cloud_linked"] is False
    device_id = uuid.UUID(body["id"])

    link = await client.post(
        f"/api/v1/devices/{device_id}/link/callback",
        json={"provider": "dropbox", "code": "auth-code"},
    )
    assert link.status_code == 200
    linked = link.json()
    assert linked["cloud_linked"] is True
    assert linked["cloud_provider"] == "dropbox"
    assert token_value not in link.text
    assert "link_ref" not in link.text

    db_session.expire_all()
    device = await db_session.get(Device, device_id)
    assert device is not None
    assert device.link_ref is not None
    assert token_value not in device.link_ref
    assert not device.link_ref.strip().startswith("{")
    assert cloud_links.parse_link_ref(device.link_ref)["token"] == token_value

    listed = await client.get("/api/v1/devices")
    assert listed.status_code == 200
    assert token_value not in listed.text
    row = next(d for d in listed.json() if d["id"] == str(device_id))
    assert row["cloud_linked"] is True

    methods = await client.get(f"/api/v1/devices/{device_id}/methods")
    assert methods.status_code == 200
    assert methods.json() == [
        {"method": "dropbox", "available": True, "reason_code": None},
    ]


async def test_undecryptable_link_ref_reports_unlinked_and_blocks_methods(
    client, db_session
) -> None:
    create = await client.post(
        "/api/v1/devices",
        json={"brand": "kobo", "model": "Forma", "name": "Kobo lost key"},
    )
    assert create.status_code == 201
    device_id = uuid.UUID(create.json()["id"])

    # Ecrire un jeton chiffre avec une autre cle → illisible avec FERNET_KEY courante.
    foreign = (
        Fernet(FOREIGN_FERNET_KEY.encode())
        .encrypt(b'{"provider":"dropbox","token":"x"}')
        .decode()
    )
    await db_session.execute(
        text("UPDATE devices SET link_ref = :ref WHERE id = :id"),
        {"ref": foreign, "id": device_id},
    )
    await db_session.commit()

    detail = await client.get(f"/api/v1/devices/{device_id}")
    assert detail.status_code == 200
    assert detail.json()["cloud_linked"] is False
    assert detail.json()["cloud_provider"] is None

    methods = await client.get(f"/api/v1/devices/{device_id}/methods")
    assert methods.status_code == 200
    assert all(m["available"] is False for m in methods.json())
    assert all(m["reason_code"] == "cloud_not_linked" for m in methods.json())


async def test_patch_device_clears_nullable_fields(client) -> None:
    create = await client.post(
        "/api/v1/devices",
        json={
            "brand": "kobo",
            "model": "Clara",
            "name": "Salon",
            "conversion_profile": "reader_6in",
        },
    )
    assert create.status_code == 201
    device_id = create.json()["id"]
    assert create.json()["conversion_profile"] == "reader_6in"

    patched = await client.patch(
        f"/api/v1/devices/{device_id}",
        json={"name": None, "model": None, "conversion_profile": None},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["name"] is None
    assert body["model"] is None
    assert body["conversion_profile"] is None
