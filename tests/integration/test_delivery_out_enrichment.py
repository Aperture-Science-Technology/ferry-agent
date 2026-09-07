"""W-11 : DeliveryOut enrichi (titre / auteur / label appareil).

Cas critique : apres suppression du livre (W-02, library_item_id SET NULL),
GET /api/v1/deliveries doit toujours renvoyer le titre historique denormalise
et un device_label lisible — pas une ligne vide.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from ferry_agent.models import DeliveryJob, DeliveryMethod, DeliveryStatus


async def test_list_deliveries_keeps_historical_title_after_book_delete(
    client, db_session, tmp_path: Path
) -> None:
    epub = tmp_path / "moby.epub"
    epub.write_bytes(b"PK\x03\x04fake-epub")

    with epub.open("rb") as fh:
        book_resp = await client.post(
            "/api/v1/books",
            files={"file": ("moby.epub", fh, "application/epub+zip")},
        )
    assert book_resp.status_code == 201
    book = book_resp.json()
    book_id = uuid.UUID(book["id"])
    historical_title = book["title"]
    historical_author = book.get("author") or ""

    device_resp = await client.post(
        "/api/v1/devices",
        json={"brand": "kindle", "model": "Paperwhite", "name": "Kindle salon"},
    )
    assert device_resp.status_code == 201
    device = device_resp.json()
    device_id = uuid.UUID(device["id"])

    job = DeliveryJob(
        library_item_id=book_id,
        device_id=device_id,
        method=DeliveryMethod.email,
        status=DeliveryStatus.delivered,
        item_title=historical_title,
        item_author=historical_author,
    )
    db_session.add(job)
    await db_session.commit()

    # Avant suppression : champs enrichis presents
    list_before = await client.get("/api/v1/deliveries")
    assert list_before.status_code == 200
    rows_before = list_before.json()
    assert len(rows_before) == 1
    assert rows_before[0]["item_title"] == historical_title
    assert rows_before[0]["item_author"] == historical_author
    assert rows_before[0]["device_label"] == "Kindle salon"
    assert rows_before[0]["library_item_id"] == str(book_id)

    del_resp = await client.delete(f"/api/v1/books/{book_id}")
    assert del_resp.status_code == 204

    # Meme session ASGI + expire_on_commit=False : forcer un rechargement DB
    # pour voir le SET NULL applique par Postgres sur library_item_id.
    db_session.expire_all()

    # Apres suppression : titre historique + device_label, pas de ligne vide
    list_after = await client.get("/api/v1/deliveries")
    assert list_after.status_code == 200
    rows_after = list_after.json()
    assert len(rows_after) == 1
    assert rows_after[0]["library_item_id"] is None
    assert rows_after[0]["item_title"] == historical_title
    assert rows_after[0]["item_author"] == historical_author
    assert rows_after[0]["device_label"] == "Kindle salon"
    assert rows_after[0]["item_title"]  # non vide
