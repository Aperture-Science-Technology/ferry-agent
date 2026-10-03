"""Régressions REST et persistance Postgres pour le contrat utilisé par le MCP."""

import uuid
from pathlib import Path

import pytest
from sqlalchemy import func, select

from ferry_agent.config import Settings
from ferry_agent.models import DeliveryJob, LibraryItem
from ferry_agent.services import delivery, library


@pytest.fixture
async def imported_book(client, db_session, tmp_path, monkeypatch):
    """Importe le résultat complet transmis par l'outil, sans passer par le web."""

    class Connector:
        async def fetch(self, result_id):
            fetched = tmp_path / "tmpmb414kk2.epub"
            fetched.write_bytes(b"PK\x03\x04livre")
            return str(fetched)

    monkeypatch.setattr(library, "get_connector", lambda name: Connector())
    monkeypatch.setattr(library, "get_settings", lambda: Settings(library_storage_dir=str(tmp_path / "livres")))
    selected = {
        "source": "gutenberg",
        "result_id": "1342",
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "language": "en",
        "isbn": "9780141439518",
        "cover_url": "https://www.gutenberg.org/cover.jpg",
    }
    response = await client.post(
        "/api/v1/books", json={"source": selected["source"], "result_id": selected["result_id"], "result": selected}
    )
    assert response.status_code == 201, response.text
    return response.json(), selected


async def test_f01_transmitted_result_is_persisted(imported_book, db_session):
    book, selected = imported_book
    db_session.expunge_all()
    persisted = await db_session.get(LibraryItem, uuid.UUID(book["id"]))
    for field in ("title", "author", "language", "isbn", "cover_url"):
        assert getattr(persisted, field) == selected[field]
    assert Path(persisted.storage_path).exists()


async def test_f02_nullable_fields_set_clear_and_read(client, imported_book):
    book, _ = imported_book
    path = f"/api/v1/books/{book['id']}"
    assert (await client.patch(path, json={"page_count": 12, "language": "fr"})).status_code == 200
    assert (await client.patch(path, json={"page_count": None})).status_code == 200
    reread = (await client.get(path)).json()
    assert reread["page_count"] is None
    assert reread["language"] == "fr"
    device = (await client.post("/api/v1/devices", json={"brand": "kindle", "name": "Salon"})).json()
    path = f"/api/v1/devices/{device['id']}"
    assert (await client.patch(path, json={"conversion_profile": "tablet"})).status_code == 200
    assert (await client.patch(path, json={"conversion_profile": None})).status_code == 200
    reread = (await client.get(path)).json()
    assert reread["conversion_profile"] is None
    assert reread["name"] == "Salon"


@pytest.mark.parametrize("requested,expected", [("mobi", "epub"), ("azw3", "epub"), ("epub", "epub"), ("pdf", "pdf")])
async def test_f03_preview_matches_delivery_without_sending(
    client, db_session, imported_book, requested, expected, monkeypatch
):
    book, _ = imported_book
    device = (await client.post("/api/v1/devices", json={"brand": "kindle"})).json()
    response = await client.get(
        "/api/v1/deliveries/preview",
        params={"library_item_id": book["id"], "device_id": device["id"], "format": requested},
    )
    assert response.status_code == 200, response.text
    assert response.json()["target_format"] == expected
    from ferry_agent.models import Device, User

    # Exécute le chemin de livraison jusqu'au choix du fichier, sans conversion ni envoi.
    produced = []

    async def materialize(db, job, item, target, target_format):
        produced.append(target_format)
        return None

    monkeypatch.setattr(delivery, "_materialize_or_fail", materialize)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)
    item = await db_session.get(LibraryItem, uuid.UUID(book["id"]))
    target = await db_session.get(Device, uuid.UUID(device["id"]))
    user = await db_session.get(User, item.user_id)
    user.kindle_email = "lecteur@kindle.com"
    await db_session.commit()
    await delivery._deliver_tier_a(db_session, DeliveryJob(), item, target, user, requested)
    assert produced == [expected]
    assert await db_session.scalar(select(func.count()).select_from(DeliveryJob)) == 0


async def test_f03_preview_rejects_missing_and_foreign_resources(client, db_session, imported_book):
    from ferry_agent.models import DeliveryTier, Device, DeviceBrand, User

    book, _ = imported_book
    other = User(email=f"autre-{uuid.uuid4().hex}@example.test")
    db_session.add(other)
    await db_session.flush()
    foreign = Device(user_id=other.id, brand=DeviceBrand.kindle, delivery_tier=DeliveryTier.A)
    db_session.add(foreign)
    await db_session.commit()
    for item_id, device_id in [(book["id"], str(foreign.id)), (str(uuid.uuid4()), str(foreign.id))]:
        response = await client.get(
            "/api/v1/deliveries/preview", params={"library_item_id": item_id, "device_id": device_id}
        )
        assert response.status_code == 404
