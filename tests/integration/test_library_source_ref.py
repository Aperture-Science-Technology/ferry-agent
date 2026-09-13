"""FA-FUNC-LIB-01 : idempotence d'import connecteur via `source_ref` (Postgres)."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from sqlalchemy import func, select

from ferry_agent.config import Settings
from ferry_agent.models import LibraryItem
from ferry_agent.services import library


class _FakeConnector:
    name = "gutenberg"

    def __init__(self, fetched_path: str) -> None:
        self._fetched_path = fetched_path
        self.fetch_calls = 0

    async def search(self, query: str) -> list:
        return []

    async def fetch(self, result_id: str) -> str:
        self.fetch_calls += 1
        return self._fetched_path


@pytest.mark.asyncio
async def test_import_from_connector_is_idempotent_on_source_ref(
    client, db_session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Deux imports du meme `gutenberg:1342` : une seule ligne, un seul fetch."""
    me = (await client.get("/api/v1/users/me")).json()
    user_id = uuid.UUID(me["id"])

    fetched = tmp_path / "pride.epub"
    fetched.write_bytes(b"PK\x03\x04fake-epub")
    storage_dir = tmp_path / "library-storage"

    connector = _FakeConnector(str(fetched))
    monkeypatch.setattr(
        "ferry_agent.services.library.get_connector",
        lambda name: connector,
    )
    monkeypatch.setattr(
        library,
        "get_settings",
        lambda: Settings(library_storage_dir=str(storage_dir)),
    )

    first = await library.import_from_connector(
        db_session,
        user_id,
        "gutenberg",
        "1342",
        metadata={"title": "Pride and Prejudice", "author": "Jane Austen"},
    )
    assert first.source_ref == "gutenberg:1342"
    assert connector.fetch_calls == 1

    # Le fichier a ete deplace : recreer au cas ou un second fetch fuirait.
    fetched.write_bytes(b"PK\x03\x04fake-epub")

    second = await library.import_from_connector(
        db_session,
        user_id,
        "gutenberg",
        "1342",
        metadata={"title": "Other title"},
    )
    assert second.id == first.id
    assert second.title == "Pride and Prejudice"
    assert connector.fetch_calls == 1

    count = await db_session.execute(
        select(func.count())
        .select_from(LibraryItem)
        .where(
            LibraryItem.user_id == user_id,
            LibraryItem.source_ref == "gutenberg:1342",
        )
    )
    assert int(count.scalar_one()) == 1
