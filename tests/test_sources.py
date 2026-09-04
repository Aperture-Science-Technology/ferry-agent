"""Tests pour l'activation/desactivation d'une Source (PATCH /api/v1/sources/{id})
et le respect de ce choix par la recherche (search_books -> library.search_all).
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from ferry_agent.api.deps import CurrentUser as CU, get_current_user
from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.models import SourceType

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"


def _fake_source(**overrides):
    source = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        type="gutenberg",
        created_at=_NOW,
        enabled=True,
    )
    for key, value in overrides.items():
        setattr(source, key, value)
    return source


def _override(fake_db):
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)


class TestUpdateSource:
    def test_disables_source(self):
        source = _fake_source(enabled=True)

        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=source))
            db.execute = AsyncMock(return_value=result)
            db.commit = AsyncMock()
            db.refresh = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch(
                    f"/api/v1/sources/{source.id}",
                    json={"enabled": False},
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["enabled"] is False
            assert source.enabled is False
        finally:
            app.dependency_overrides.clear()

    def test_404_for_other_users_source(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch(
                    f"/api/v1/sources/{uuid.uuid4()}",
                    json={"enabled": False},
                )
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()


class TestSearchBooksRespectsDisabledSources:
    def test_disabled_gutenberg_excluded_from_search(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock()
            result.scalars = MagicMock(
                return_value=MagicMock(all=MagicMock(return_value=[SourceType.gutenberg]))
            )
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with patch(
                "ferry_agent.api.books.library.search_all",
                new=AsyncMock(return_value=[]),
            ) as mock_search_all:
                with TestClient(app) as client:
                    resp = client.post(
                        "/api/v1/books/search",
                        json={"query": "pride", "scope": ["legal"]},
                    )
                assert resp.status_code == 200
                mock_search_all.assert_awaited_once_with("pride", exclude={"gutenberg"})
        finally:
            app.dependency_overrides.clear()
