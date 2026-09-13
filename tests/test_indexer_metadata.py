"""Phase F2 : persistance des metadata d'indexeur (auteur, cover, langue, ...)
a l'ajout d'un livre, via un connecteur (Gutenberg/Standard Ebooks) ou via un
resultat gateway.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import Settings
from ferry_agent.connectors.gutenberg import GutenbergConnector
from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.services import library

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"


@pytest.mark.asyncio
async def test_gutendex_sets_cover_url_and_language_from_formats() -> None:
    payload = {
        "results": [
            {
                "id": 1342,
                "title": "Pride and Prejudice",
                "authors": [{"name": "Austen, Jane"}],
                "languages": ["en"],
                "formats": {
                    "application/epub+zip": "https://www.gutenberg.org/ebooks/1342.epub.images",
                    "image/jpeg": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
                },
            }
        ]
    }
    response = httpx.Response(
        200, json=payload, request=httpx.Request("GET", "https://gutendex.com/books/")
    )

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("ferry_agent.connectors.gutenberg.httpx.AsyncClient", return_value=mock_client):
        results = await GutenbergConnector().search("pride")

    assert len(results) == 1
    result = results[0]
    assert result.cover_url == "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg"
    assert result.language == "en"
    assert result.author == "Austen, Jane"


class _FakeConnector:
    name = "gutenberg"

    def __init__(self, fetched_path: str) -> None:
        self._fetched_path = fetched_path

    async def search(self, query: str) -> list:
        return []

    async def fetch(self, result_id: str) -> str:
        return self._fetched_path


@pytest.mark.asyncio
async def test_import_from_connector_persists_metadata(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    fetched = tmp_path / "downloaded.epub"
    fetched.write_bytes(b"fake-epub-content")

    storage_dir = tmp_path / "storage"
    settings = Settings(library_storage_dir=str(storage_dir))
    monkeypatch.setattr(library, "get_settings", lambda: settings)
    monkeypatch.setattr(
        "ferry_agent.services.library.get_connector",
        lambda name: _FakeConnector(str(fetched)),
    )

    db = AsyncMock()
    source_result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    db.execute = AsyncMock(return_value=source_result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()

    metadata = {
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "cover_url": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
        "language": "en",
        "description": "A classic novel.",
        "page_count": 432,
    }

    item = await library.import_from_connector(
        db, _USER_ID, "gutenberg", "1342", metadata=metadata
    )

    assert item.title == "Pride and Prejudice"
    assert item.author == "Jane Austen"
    assert item.cover_url == metadata["cover_url"]
    assert item.language == "en"
    assert item.description == "A classic novel."
    assert item.page_count == 432


@pytest.mark.asyncio
async def test_import_from_connector_falls_back_to_filename_stem_without_metadata(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fetched = tmp_path / "some_book_title.epub"
    fetched.write_bytes(b"fake-epub-content")

    storage_dir = tmp_path / "storage"
    settings = Settings(library_storage_dir=str(storage_dir))
    monkeypatch.setattr(library, "get_settings", lambda: settings)
    monkeypatch.setattr(
        "ferry_agent.services.library.get_connector",
        lambda name: _FakeConnector(str(fetched)),
    )

    db = AsyncMock()
    source_result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    db.execute = AsyncMock(return_value=source_result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()

    item = await library.import_from_connector(db, _USER_ID, "gutenberg", "42")

    assert item.title == "some_book_title"
    assert item.author == ""
    assert item.cover_url is None


@pytest.mark.asyncio
async def test_import_from_connector_returns_existing_on_same_source_ref(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Re-ajout du meme resultat : retourne l'item existant sans re-fetch."""
    fetched = tmp_path / "should-not-be-used.epub"
    fetched.write_bytes(b"fake-epub-content")

    storage_dir = tmp_path / "storage"
    settings = Settings(library_storage_dir=str(storage_dir))
    monkeypatch.setattr(library, "get_settings", lambda: settings)

    connector = _FakeConnector(str(fetched))
    connector.fetch = AsyncMock(side_effect=AssertionError("fetch must not run"))  # type: ignore[method-assign]
    monkeypatch.setattr(
        "ferry_agent.services.library.get_connector",
        lambda name: connector,
    )

    existing = _fake_library_item(source_ref="gutenberg:1342", title="Already owned")
    existing_result = MagicMock(scalar_one_or_none=MagicMock(return_value=existing))
    db = AsyncMock()
    db.execute = AsyncMock(return_value=existing_result)
    db.commit = AsyncMock()
    db.add = MagicMock()

    item = await library.import_from_connector(
        db, _USER_ID, "gutenberg", "1342", metadata={"title": "Ignored"}
    )

    assert item is existing
    assert item.title == "Already owned"
    db.add.assert_not_called()
    db.commit.assert_not_called()


def _fake_library_item(**overrides):
    item = SimpleNamespace(
        id=uuid.uuid4(),
        title="Pride and Prejudice",
        author="Jane Austen",
        cover_url="https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
        source_id=uuid.uuid4(),
        original_format="epub",
        added_at=_NOW,
        description="A classic novel.",
        language="en",
        page_count=432,
        size_bytes=1234,
        isbn=None,
        publisher=None,
        published_year=None,
    )
    for key, value in overrides.items():
        setattr(item, key, value)
    return item


def test_post_books_connector_branch_passes_result_metadata() -> None:
    fake_item = _fake_library_item()

    async def fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=_USER_ID, email=_USER_EMAIL)

    captured = {}

    async def fake_import_from_connector(db, user_id, source_name, result_id, *, metadata=None):
        captured["source_name"] = source_name
        captured["result_id"] = result_id
        captured["metadata"] = metadata
        return fake_item

    try:
        with patch(
            "ferry_agent.api.books.library.import_from_connector",
            side_effect=fake_import_from_connector,
        ):
            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/books",
                    json={
                        "source": "gutenberg",
                        "result_id": "1342",
                        "result": {
                            "author": "Jane Austen",
                            "cover_url": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
                            "language": "en",
                            "description": "A classic novel.",
                            "page_count": 432,
                        },
                    },
                )
        assert resp.status_code == 201
        data = resp.json()
        assert data["author"] == "Jane Austen"
        assert data["cover_url"] == "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg"
        assert data["language"] == "en"
        assert data["page_count"] == 432
        assert captured["metadata"]["author"] == "Jane Austen"
        assert captured["source_name"] == "gutenberg"
        assert captured["result_id"] == "1342"
    finally:
        app.dependency_overrides.clear()
