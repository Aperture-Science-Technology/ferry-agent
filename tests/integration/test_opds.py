"""W-28 / FA-FUNC-OPDS-01 : catalogue OPDS (Postgres reel).

Couvre creation (hash only), pagination SQL, recherche, telechargement,
couverture locale, et revocation (404 partout, comme introuvable).
"""

from __future__ import annotations

import uuid
from pathlib import Path
from xml.etree import ElementTree as ET

from sqlalchemy import select

from ferry_agent.models import LibraryItem, OpdsToken, User
from ferry_agent.services.opds import PAGE_SIZE

ATOM = "{http://www.w3.org/2005/Atom}"


async def _seed_books(db_session, user_id: uuid.UUID, n: int, tmp_path: Path) -> list[LibraryItem]:
    items: list[LibraryItem] = []
    for i in range(n):
        path = tmp_path / f"book-{i:03d}.epub"
        path.write_bytes(b"PK\x03\x04fake-epub")
        cover = tmp_path / f"cover-{i:03d}.png"
        cover.write_bytes(b"\x89PNG\r\n\x1a\n")
        item = LibraryItem(
            user_id=user_id,
            title=f"Book {i:03d}",
            author=f"Author {i % 3}",
            original_format="epub",
            storage_path=str(path),
            size_bytes=path.stat().st_size,
            cover_url=str(cover) if i == 0 else None,
        )
        db_session.add(item)
        items.append(item)
    await db_session.commit()
    for item in items:
        await db_session.refresh(item)
    return items


async def _create_token(client, label: str = "Kobo test") -> tuple[str, str]:
    created = await client.post("/api/v1/opds/tokens", json={"label": label})
    assert created.status_code == 201
    body = created.json()
    assert "token" in body
    assert body["url"].endswith(f"/opds/{body['token']}")
    assert "token_hash" not in body
    return body["token"], body["id"]


async def test_opds_create_stores_hash_only(client, db_session) -> None:
    raw, token_id = await _create_token(client, "Hash check")
    row = (
        await db_session.execute(select(OpdsToken).where(OpdsToken.id == uuid.UUID(token_id)))
    ).scalar_one()
    assert row.token_hash != raw
    assert len(row.token_hash) == 64
    assert raw not in (row.label, row.token_hash)

    listed = await client.get("/api/v1/opds/tokens")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert payload[0]["id"] == token_id
    assert "token" not in payload[0]
    assert "token_hash" not in payload[0]


async def test_opds_all_paginates_with_sql_limit(client, db_session, tmp_path: Path) -> None:
    """Un flux /all non pagine s'ecroule : on verifie limit/offset SQL (25/page)."""
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    total = PAGE_SIZE + 7
    await _seed_books(db_session, user_id, total, tmp_path)

    raw, _token_id = await _create_token(client)

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

    row = (
        await db_session.execute(select(OpdsToken).where(OpdsToken.id == uuid.UUID(_token_id)))
    ).scalar_one()
    await db_session.refresh(row)
    assert row.last_used_at is not None


async def test_opds_search_filters_and_preserves_query(client, db_session, tmp_path: Path) -> None:
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    await _seed_books(db_session, user_id, 6, tmp_path)
    raw, _ = await _create_token(client, "Search")

    resp = await client.get(f"/opds/{raw}/search", params={"q": "Author 1", "page": 1})
    assert resp.status_code == 200
    assert "application/atom+xml" in resp.headers["content-type"]
    root = ET.fromstring(resp.content)
    titles = {e.findtext(f"{ATOM}title") for e in root.findall(f"{ATOM}entry")}
    assert titles == {"Book 001", "Book 004"}
    self_href = next(
        link.get("href") for link in root.findall(f"{ATOM}link") if link.get("rel") == "self"
    )
    assert "q=Author+1" in self_href or "q=Author%201" in self_href

    # Joker SQL litteral : '%' ne doit pas tout matcher
    wild = await client.get(f"/opds/{raw}/search", params={"q": "%"})
    assert wild.status_code == 200
    wild_titles = {
        e.findtext(f"{ATOM}title")
        for e in ET.fromstring(wild.content).findall(f"{ATOM}entry")
    }
    assert wild_titles == set()


async def test_opds_download_and_cover(client, db_session, tmp_path: Path) -> None:
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    items = await _seed_books(db_session, user_id, 2, tmp_path)
    raw, _ = await _create_token(client, "Download")

    feed = await client.get(f"/opds/{raw}/all")
    assert feed.status_code == 200
    root = ET.fromstring(feed.content)
    acq_links = [
        link.get("href")
        for entry in root.findall(f"{ATOM}entry")
        for link in entry.findall(f"{ATOM}link")
        if link.get("rel") == "http://opds-spec.org/acquisition"
    ]
    assert any(f"/download/{items[0].id}" in (href or "") for href in acq_links)

    download = await client.get(f"/opds/{raw}/download/{items[0].id}")
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("application/epub+zip")
    assert download.content.startswith(b"PK\x03\x04")
    assert "attachment" in download.headers.get("content-disposition", "")

    cover = await client.get(f"/opds/{raw}/cover/{items[0].id}", follow_redirects=False)
    assert cover.status_code == 200
    assert cover.headers["content-type"].startswith("image/png")
    assert cover.content.startswith(b"\x89PNG")

    missing_cover = await client.get(
        f"/opds/{raw}/cover/{items[1].id}", follow_redirects=False
    )
    assert missing_cover.status_code == 404

    stranger = User(email=f"stranger-{uuid.uuid4().hex}@example.test")
    db_session.add(stranger)
    await db_session.commit()
    await db_session.refresh(stranger)
    secret_path = tmp_path / "secret.epub"
    secret_path.write_bytes(b"PKSECRET")
    secret = LibraryItem(
        user_id=stranger.id,
        title="Secret",
        author="Nope",
        original_format="epub",
        storage_path=str(secret_path),
        size_bytes=secret_path.stat().st_size,
    )
    db_session.add(secret)
    await db_session.commit()
    await db_session.refresh(secret)

    denied = await client.get(f"/opds/{raw}/download/{secret.id}")
    assert denied.status_code == 404


async def test_opds_revoked_token_returns_404(client, db_session, tmp_path: Path) -> None:
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])
    items = await _seed_books(db_session, user_id, 1, tmp_path)

    raw, token_id = await _create_token(client, "Temp")

    ok = await client.get(f"/opds/{raw}")
    assert ok.status_code == 200

    revoked = await client.post(
        "/api/v1/opds/tokens/revoke",
        json={"token_id": token_id},
    )
    assert revoked.status_code == 200

    for path in (
        f"/opds/{raw}",
        f"/opds/{raw}/all",
        f"/opds/{raw}/search?q=Book",
        f"/opds/{raw}/download/{items[0].id}",
        f"/opds/{raw}/cover/{items[0].id}",
        f"/opds/{raw}/opensearch.xml",
    ):
        denied = await client.get(path)
        assert denied.status_code == 404, path

    listed = await client.get("/api/v1/opds/tokens")
    assert listed.json() == []


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
