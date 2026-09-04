"""Tests du croisement "deja possede" (POST /api/v1/books/search -> owned).

Identite titre + auteur + provider : un resultat est marque `owned` quand son
titre et son auteur normalises correspondent a un LibraryItem possede par
l'utilisateur ET que les deux partagent le meme provider (source). Le
provider est la dimension discriminante ajoutee pour eviter les faux
positifs entre editions differentes (ex. Gutenberg vs PocketBook) partageant
titre et auteur. Un isbn identique reste un critere bonus independant.
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
from ferry_agent.models import SourceType

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


def _run_search(owned_rows, results):
    """`owned_rows` : liste de tuples (LibraryItem-like, SourceType | None),
    simulant les lignes renvoyees par le join LibraryItem/Source."""

    async def fake_db():
        db = AsyncMock()
        disabled_sources_result = MagicMock()
        disabled_sources_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=[]))
        )
        owned_items_result = MagicMock()
        owned_items_result.all = MagicMock(return_value=owned_rows)
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


class TestOwnedMatchingTitleAuthorProvider:
    def test_same_title_author_provider_is_owned(self):
        owned = [(_fake_owned_item(title="Dune", author="Herbert"), SourceType.gutenberg)]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="999",
            author="Herbert",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is True

    def test_same_title_author_but_different_provider_is_not_owned(self):
        owned = [(_fake_owned_item(title="Dune", author="Herbert"), SourceType.standard_ebooks)]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="999",
            author="Herbert",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is False

    def test_same_title_but_different_author_is_not_owned(self):
        owned = [(_fake_owned_item(title="Dune", author="Herbert"), SourceType.gutenberg)]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="999",
            author="Someone Else",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is False

    def test_matching_isbn_marks_owned_regardless_of_title_author(self):
        owned = [
            (
                _fake_owned_item(title="Dune", author="Herbert", isbn="978-0-441-17271-9"),
                SourceType.gutenberg,
            )
        ]
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

    def test_gateway_provider_matches_torrent_gateway_source_type(self):
        owned = [(_fake_owned_item(title="Dune", author="Herbert"), SourceType.torrent_gateway)]
        result = Result(
            source="gateway:11111111-1111-1111-1111-111111111111",
            title="Dune",
            result_id="999",
            author="Herbert",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is True

    def test_title_only_match_without_author_on_either_side_is_owned(self):
        owned = [(_fake_owned_item(title="Dune", author=""), SourceType.gutenberg)]
        result = Result(
            source="gutenberg",
            title="Dune",
            result_id="999",
            author="",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is True

    def test_no_match_is_not_owned(self):
        owned = [(_fake_owned_item(title="Dune", author="Herbert"), SourceType.gutenberg)]
        result = Result(
            source="gutenberg",
            title="Something else",
            result_id="999",
            author="Herbert",
        )

        data = _run_search(owned, [result])

        assert len(data) == 1
        assert data[0]["owned"] is False
