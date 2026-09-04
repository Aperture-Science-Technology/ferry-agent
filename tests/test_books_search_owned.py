"""Tests du croisement "deja possede" (POST /api/v1/books/search -> owned).

Identite stricte : un resultat n'est marque `owned` que sur une
correspondance exacte d'isbn ou de reference source (source+result_id).
Aucun fallback titre/auteur, meme si titre et auteur sont identiques
(cf. workstream badge "deja possede" avec identite stricte).
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from ferry_agent.api.deps import CurrentUser as CU, get_current_user
from ferry_agent.connectors import Result
from ferry_agent.db import get_db
from ferry_agent.main import app

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"


def _fake_owned_item(**overrides):
    item = SimpleNamespace(
        title="Dune",
        author="Herbert",
        isbn=None,
        source_ref=None,
    )
    for key, value in overrides.items():
        setattr(item, key, value)
    return item


def _override(fake_db):
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)


def _run_search(owned_items, results):
    async def fake_db():
        db = AsyncMock()
        disabled_sources_result = MagicMock()
        disabled_sources_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=[]))
        )
        owned_items_result = MagicMock()
        owned_items_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=owned_items))
        )
        db.execute = AsyncMock(side_effect=[disabled_sources_result, owned_items_result])
        yield db

    _override(fake_db)
    try:
        with patch(
            "ferry_agent.api.books.library.search_all",
            new=AsyncMock(return_value=results),
        ):
            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/books/search",
                    json={"query": "dune", "scope": ["legal"]},
                )
        assert resp.status_code == 200
        return resp.json()
    finally:
        app.dependency_overrides.clear()


class TestOwnedMatchingIsStrict:
    def test_same_title_and_author_but_different_isbn_is_not_owned(self):
        owned = [_fake_owned_item(title="Dune", author="Herbert", isbn="9780441172719")]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="999",
            author="Herbert",
            isbn="9780000000000",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is False

    def test_matching_isbn_marks_owned(self):
        owned = [_fake_owned_item(title="Dune", author="Herbert", isbn="978-0-441-17271-9")]
        result = Result(
            source="gutenberg",
            title="Dune (different edition)",
            result_id="999",
            author="Frank Herbert",
            isbn="9780441172719",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is True

    def test_matching_source_ref_marks_owned(self):
        owned = [
            _fake_owned_item(
                title="Some other title",
                author="Some other author",
                source_ref="gutenberg:12345",
            )
        ]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="12345",
            author="Herbert",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is True

    def test_no_isbn_and_no_ref_match_is_not_owned(self):
        owned = [_fake_owned_item(title="Dune", author="Herbert")]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="999",
            author="Herbert",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is False
