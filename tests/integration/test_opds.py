"""W-28 : pagination OPDS + revocation de jeton (Postgres reel)."""

from __future__ import annotations

import uuid
from pathlib import Path
from xml.etree import ElementTree as ET

from sqlalchemy import select

from ferry_agent.models import LibraryItem, OpdsToken
from ferry_agent.services.opds import PAGE_SIZE

ATOM = "{http://www.w3.org/2005/Atom}"


async def _seed_books(db_session, user_id: uuid.UUID, n: int, tmp_path: Path) -> None:
    for i in range(n):
        path = tmp_path / f"book-{i:03d}.epub"
        path.write_bytes(b"PK\x03\x04fake-epub")
        db_session.add(
            LibraryItem(
                user_id=user_id,
                title=f"Book {i:03d}",
                author=f"Author {i % 3}",
                original_format="epub",
                storage_path=str(path),
                size_bytes=path.stat().st_size,
            )
        )
    await db_session.commit()


async def test_opds_all_paginates_with_sql_limit(client, db_session, tmp_path: Path) -> None:
    """Un flux /all non pagine s'ecroule : on verifie limit/offset SQL (25/page)."""
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    total = PAGE_SIZE + 7
    await _seed_books(db_session, user_id, total, tmp_path)

    created = await client.post("/api/v1/opds/tokens", json={"label": "Kobo test"})
    assert created.status_code == 201
    body = created.json()
    raw = body["token"]
    assert body["url"].endswith(f"/opds/{raw}")
    assert "token_hash" not in body

    row = (
        await db_session.execute(select(OpdsToken).where(OpdsToken.id == uuid.UUID(body["id"])))
    ).scalar_one()
    assert row.token_hash != raw
    assert len(row.token_hash) == 64

    page1 = await client.get(f"/opds/{raw}/all?page=1")
    assert page1.status_code == 200
    assert "application/atom+xml" in page1.headers["content-type"]
    root1 = ET.fromstring(page1.content)
    entries1 = root1.findall(f"{ATOM}entry")
    assert len(entries1) == PAGE_SIZE
    rels1 = {link.get("rel") for link in root1.findall(f"{ATOM}link")}
    assert "next" in rels1

    page2 = await client.get(f"/opds/{raw}/all?page=2")
    assert page2.status_code == 200
    root2 = ET.fromstring(page2.content)
    entries2 = root2.findall(f"{ATOM}entry")
    assert len(entries2) == 7
    titles1 = {e.findtext(f"{ATOM}title") for e in entries1}
    titles2 = {e.findtext(f"{ATOM}title") for e in entries2}
    assert titles1.isdisjoint(titles2)

    await db_session.refresh(row)
    assert row.last_used_at is not None


async def test_opds_revoked_token_returns_404(client, db_session, tmp_path: Path) -> None:
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    await _seed_books(db_session, user_id, 1, tmp_path)

    created = await client.post("/api/v1/opds/tokens", json={"label": "Temp"})
    assert created.status_code == 201
    raw = created.json()["token"]
    token_id = created.json()["id"]

    ok = await client.get(f"/opds/{raw}")
    assert ok.status_code == 200

    revoked = await client.post(
        "/api/v1/opds/tokens/revoke",
        json={"token_id": token_id},
    )
    assert revoked.status_code == 200

    denied = await client.get(f"/opds/{raw}")
    assert denied.status_code == 404
    denied_all = await client.get(f"/opds/{raw}/all")
    assert denied_all.status_code == 404


async def test_books_list_pagination(client, db_session, tmp_path: Path) -> None:
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    await _seed_books(db_session, user_id, 12, tmp_path)

    page1 = await client.get("/api/v1/books?page=1&limit=5")
    assert page1.status_code == 200
    data1 = page1.json()
    assert data1["total"] == 12
    assert data1["page"] == 1
    assert data1["limit"] == 5
    assert len(data1["items"]) == 5

    page2 = await client.get("/api/v1/books?page=2&limit=5")
    assert page2.status_code == 200
    data2 = page2.json()
    assert len(data2["items"]) == 5
    ids1 = {item["id"] for item in data1["items"]}
    ids2 = {item["id"] for item in data2["items"]}
    assert ids1.isdisjoint(ids2)

    page3 = await client.get("/api/v1/books?page=3&limit=5")
    assert page3.status_code == 200
    assert len(page3.json()["items"]) == 2
