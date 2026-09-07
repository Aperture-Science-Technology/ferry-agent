"""W-02 : DELETE livre / device ne doivent plus 500 quand des FK existent."""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy import select

from ferry_agent.models import (
    DeliveryJob,
    DeliveryMethod,
    DeliveryStatus,
    DeliveryTier,
    ShortCode,
)
from ferry_agent.services import tierc


async def test_delete_book_with_delivery_history_returns_204(client, db_session, tmp_path: Path) -> None:
    """Supprimer un livre livre au moins une fois : 204 + historique conserve."""
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

    device_resp = await client.post(
        "/api/v1/devices",
        json={"brand": "kindle", "model": "Paperwhite", "name": "Kindle test"},
    )
    assert device_resp.status_code == 201
    device_id = uuid.UUID(device_resp.json()["id"])

    job = DeliveryJob(
        library_item_id=book_id,
        device_id=device_id,
        method=DeliveryMethod.email,
        status=DeliveryStatus.delivered,
        item_title=book["title"],
        item_author=book.get("author") or "",
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    job_id = job.id

    del_resp = await client.delete(f"/api/v1/books/{book_id}")
    assert del_resp.status_code == 204

    db_session.expire_all()
    surviving = await db_session.get(DeliveryJob, job_id)
    assert surviving is not None
    assert surviving.library_item_id is None
    assert surviving.item_title == book["title"]


async def test_delete_device_with_shortcodes_returns_204(client, db_session, tmp_path: Path) -> None:
    """Supprimer une liseuse tier C avec short codes : 204 + codes cascades."""
    epub = tmp_path / "dune.epub"
    epub.write_bytes(b"PK\x03\x04fake-epub")

    with epub.open("rb") as fh:
        book_resp = await client.post(
            "/api/v1/books",
            files={"file": ("dune.epub", fh, "application/epub+zip")},
        )
    assert book_resp.status_code == 201
    book_id = uuid.UUID(book_resp.json()["id"])

    device_resp = await client.post(
        "/api/v1/devices",
        json={"brand": "kobo", "model": "Clara 2E", "name": "Kobo test"},
    )
    assert device_resp.status_code == 201
    device = device_resp.json()
    assert device["delivery_tier"] == DeliveryTier.C.value
    device_id = uuid.UUID(device["id"])

    job = DeliveryJob(
        library_item_id=book_id,
        device_id=device_id,
        method=DeliveryMethod.browser_code,
        status=DeliveryStatus.queued,
        item_title=book_resp.json()["title"],
        item_author="",
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    short_code, _url = await tierc.create_download_session(db_session, job.id)
    code_value = short_code.code
    job_id = job.id

    del_resp = await client.delete(f"/api/v1/devices/{device_id}")
    assert del_resp.status_code == 204

    db_session.expire_all()
    remaining = await db_session.execute(select(ShortCode).where(ShortCode.code == code_value))
    assert remaining.scalar_one_or_none() is None
    assert await db_session.get(DeliveryJob, job_id) is None
