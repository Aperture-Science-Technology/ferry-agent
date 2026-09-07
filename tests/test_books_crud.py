"""Tests pour l'edition, la suppression et l'historique de livraisons d'un
LibraryItem :
- PATCH  /api/v1/books/{item_id}
- DELETE /api/v1/books/{item_id}
- GET    /api/v1/books/{item_id}/deliveries

Toutes les routes sont scopees par user_id (404 si le livre appartient a un
autre utilisateur), suivant le pattern deja utilise par api/deliveries.py.
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from ferry_agent.main import app
from ferry_agent.models import DeliveryMethod, DeliveryStatus

from tests.fakes import clear_app_deps, override_app_deps

_NOW = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"
_OTHER_USER_ID = uuid.uuid4()


def _fake_item(**overrides):
    item = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        title="Dune",
        author="Herbert",
        cover_url=None,
        source_id=None,
        original_format="epub",
        storage_path="/tmp/does-not-exist-ferry-agent-test.epub",
        added_at=_NOW,
        description=None,
        language=None,
        page_count=None,
        size_bytes=None,
        isbn=None,
        publisher=None,
        published_year=None,
    )
    for key, value in overrides.items():
        setattr(item, key, value)
    return item


def _fake_delivery(library_item_id, **overrides):
    job = SimpleNamespace(
        id=uuid.uuid4(),
        library_item_id=library_item_id,
        device_id=uuid.uuid4(),
        status=DeliveryStatus.delivered,
        method=DeliveryMethod.email,
        created_at=_NOW,
        delivered_at=_NOW,
        error=None,
    )
    for key, value in overrides.items():
        setattr(job, key, value)
    return job


def _override(fake_db):
    override_app_deps(fake_db, user_id=_USER_ID, email=_USER_EMAIL)


class TestUpdateBook:
    def test_updates_provided_fields_only(self):
        item = _fake_item(title="Dune", author="Herbert", language=None)

        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=item))
            db.execute = AsyncMock(return_value=result)
            db.commit = AsyncMock()
            db.refresh = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch(
                    f"/api/v1/books/{item.id}",
                    json={"title": "Dune Messiah", "language": "fr"},
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["title"] == "Dune Messiah"
            assert data["language"] == "fr"
            # Champ non fourni : inchange
            assert data["author"] == "Herbert"
        finally:
            clear_app_deps()

    def test_404_for_other_users_book(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch(
                    f"/api/v1/books/{uuid.uuid4()}",
                    json={"title": "Nope"},
                )
            assert resp.status_code == 404
        finally:
            clear_app_deps()


class TestDeleteBook:
    def test_delete_returns_204(self):
        item = _fake_item()

        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=item))
            db.execute = AsyncMock(return_value=result)
            db.delete = AsyncMock()
            db.commit = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.delete(f"/api/v1/books/{item.id}")
            assert resp.status_code == 204
            assert resp.content == b""
        finally:
            clear_app_deps()

    def test_delete_removed_item_not_listable(self):
        item = _fake_item()
        remaining: list = []

        async def fake_db():
            db = AsyncMock()

            async def fake_execute(query):
                # Premiere requete (delete) : retrouve l'item par id+user.
                # Deuxieme requete (list) : retourne ce qui reste (vide).
                result = MagicMock()
                result.scalar_one_or_none = MagicMock(return_value=item if not remaining else None)
                result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=remaining)))
                return result

            db.execute = AsyncMock(side_effect=fake_execute)
            db.delete = AsyncMock()
            db.commit = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                del_resp = client.delete(f"/api/v1/books/{item.id}")
                assert del_resp.status_code == 204
                list_resp = client.get("/api/v1/books")
                assert list_resp.status_code == 200
                assert list_resp.json() == []
        finally:
            clear_app_deps()

    def test_404_for_other_users_book(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.delete(f"/api/v1/books/{uuid.uuid4()}")
            assert resp.status_code == 404
        finally:
            clear_app_deps()


class TestBookDeliveries:
    def test_returns_only_this_books_deliveries(self):
        item = _fake_item()
        jobs = [_fake_delivery(item.id), _fake_delivery(item.id)]

        async def fake_db():
            db = AsyncMock()

            async def fake_execute(query):
                result = MagicMock()
                result.scalar_one_or_none = MagicMock(return_value=item)
                # list_book_deliveries lit result.all() (tuples job + enrichissements)
                result.all = MagicMock(
                    return_value=[
                        (job, item.title, item.author, "Kindle test", None, None) for job in jobs
                    ]
                )
                return result

            db.execute = AsyncMock(side_effect=fake_execute)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.get(f"/api/v1/books/{item.id}/deliveries")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2
            assert all(d["library_item_id"] == str(item.id) for d in data)
            assert all(d["item_title"] == item.title for d in data)
            assert all(d["device_label"] == "Kindle test" for d in data)
        finally:
            clear_app_deps()

    def test_404_for_other_users_book(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.get(f"/api/v1/books/{uuid.uuid4()}/deliveries")
            assert resp.status_code == 404
        finally:
            clear_app_deps()
