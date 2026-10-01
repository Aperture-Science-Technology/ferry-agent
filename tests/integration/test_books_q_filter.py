"""FA-MCP Lot 3A : filtre `q` sur GET /api/v1/books (ILIKE title|author)."""

from __future__ import annotations

from pathlib import Path


async def test_list_books_q_filters_title_or_author(client, tmp_path: Path) -> None:
    """Le filtre `q` restreint count + page (casse ignoree, title OU author)."""
    for name, title, author in (
        ("dune.epub", "Dune", "Frank Herbert"),
        ("foundation.epub", "Foundation", "Isaac Asimov"),
        ("hyperion.epub", "Hyperion", "Dan Simmons"),
    ):
        epub = tmp_path / name
        epub.write_bytes(b"PK\x03\x04fake-epub")
        with epub.open("rb") as fh:
            resp = await client.post(
                "/api/v1/books",
                files={"file": (name, fh, "application/epub+zip")},
            )
        assert resp.status_code == 201, resp.text
        item_id = resp.json()["id"]
        patch = await client.patch(
            f"/api/v1/books/{item_id}",
            json={"title": title, "author": author},
        )
        assert patch.status_code == 200, patch.text

    all_resp = await client.get("/api/v1/books", params={"limit": 50})
    assert all_resp.status_code == 200
    assert all_resp.json()["total"] >= 3

    by_title = await client.get("/api/v1/books", params={"q": "dune", "limit": 50})
    assert by_title.status_code == 200
    data = by_title.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Dune"

    by_author = await client.get("/api/v1/books", params={"q": "asimov", "limit": 50})
    assert by_author.status_code == 200
    data = by_author.json()
    assert data["total"] == 1
    assert data["items"][0]["author"] == "Isaac Asimov"

    none = await client.get("/api/v1/books", params={"q": "zzzz-no-match", "limit": 50})
    assert none.status_code == 200
    assert none.json() == {"items": [], "total": 0, "page": 1, "limit": 50}
