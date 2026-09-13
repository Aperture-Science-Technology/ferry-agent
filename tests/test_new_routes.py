"""Tests des nouvelles routes ajoutées pour M5 :
- GET /api/v1/books         (liste des LibraryItem)
- POST /api/v1/devices      (création + calcul delivery_tier)
- GET /api/v1/sources       (liste des sources)
- GET /api/v1/users/me      (profil)
- PATCH /api/v1/users/me    (mise à jour partielle)
- X-API-Key auth            (supprimé ; X-API-Key seul → 401)
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ferry_agent.main import app
from ferry_agent.models import DeliveryTier, DeviceBrand


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"


def _fake_user():
    return SimpleNamespace(
        id=_USER_ID,
        email=_USER_EMAIL,
        kindle_email=None,
        default_format="epub",
        created_at=_NOW,
    )


def _fake_item(title="Dune"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        title=title,
        author="Herbert",
        cover_url=None,
        source_id=None,
        original_format="epub",
        storage_path="/data/dune.epub",
        added_at=_NOW,
    )


def _fake_device(brand=DeviceBrand.kindle, model="Paperwhite", tier=DeliveryTier.A):
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        brand=brand,
        model=model,
        delivery_tier=tier,
        link_ref=None,
        last_synced_at=None,
    )


def _fake_source(enabled=True):
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        type="gutenberg",
        config={},
        created_at=_NOW,
        enabled=enabled,
    )


# ---------------------------------------------------------------------------
# GET /api/v1/books
# ---------------------------------------------------------------------------

class TestListBooks:
    def test_returns_items(self):
        items = [_fake_item("Dune"), _fake_item("Foundation")]

        class CountResult:
            def scalar_one(self):
                return 2

        class ItemsResult:
            def scalars(self):
                return MagicMock(all=MagicMock(return_value=items))

        async def fake_db():
            db = AsyncMock()
            db.execute = AsyncMock(side_effect=[CountResult(), ItemsResult()])
            yield db

        from ferry_agent.api.deps import CurrentUser as CU, get_current_user
        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = client.get("/api/v1/books")
            assert resp.status_code == 200
            data = resp.json()
            assert data["total"] == 2
            assert data["page"] == 1
            assert len(data["items"]) == 2
            titles = {d["title"] for d in data["items"]}
            assert "Dune" in titles
            assert "Foundation" in titles
        finally:
            app.dependency_overrides.clear()

    def test_empty_list(self):
        class CountResult:
            def scalar_one(self):
                return 0

        class ItemsResult:
            def scalars(self):
                return MagicMock(all=MagicMock(return_value=[]))

        async def fake_db():
            db = AsyncMock()
            db.execute = AsyncMock(side_effect=[CountResult(), ItemsResult()])
            yield db

        from ferry_agent.api.deps import CurrentUser as CU, get_current_user
        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = client.get("/api/v1/books")
            assert resp.status_code == 200
            assert resp.json() == {"items": [], "total": 0, "page": 1, "limit": 50}
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /api/v1/devices — tier mapping
# ---------------------------------------------------------------------------

class TestCreateDevice:
    def _post(self, brand: str, model: str | None = None) -> tuple[int, list]:
        created: list = []

        async def fake_db():
            db = AsyncMock()

            def fake_add(obj):
                # Simule l'assignation d'un UUID par SQLAlchemy
                obj.id = uuid.uuid4()
                obj.last_synced_at = None
                obj.link_ref = None
                created.append(obj)

            db.add = MagicMock(side_effect=fake_add)
            db.commit = AsyncMock()
            db.refresh = AsyncMock()
            yield db

        from ferry_agent.api.deps import CurrentUser as CU, get_current_user
        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)

        try:
            with TestClient(app) as client:
                payload = {"brand": brand}
                if model:
                    payload["model"] = model
                resp = client.post("/api/v1/devices", json=payload)
            return resp.status_code, created
        finally:
            app.dependency_overrides.clear()

    def test_kindle_tier_a(self):
        status, created = self._post("kindle", "Paperwhite")
        assert status == 201
        assert created[0].delivery_tier == DeliveryTier.A

    def test_kobo_high_end_tier_b(self):
        status, created = self._post("kobo", "Forma")
        assert status == 201
        assert created[0].delivery_tier == DeliveryTier.B

    def test_kobo_libra_colour_tier_b(self):
        status, created = self._post("kobo", "Libra Colour")
        assert status == 201
        assert created[0].delivery_tier == DeliveryTier.B

    def test_kobo_entry_tier_c(self):
        status, created = self._post("kobo", "Clara")
        assert status == 201
        assert created[0].delivery_tier == DeliveryTier.C

    def test_tolino_tier_c(self):
        status, created = self._post("tolino", "Vision")
        assert status == 201
        assert created[0].delivery_tier == DeliveryTier.C

    def test_other_tier_d(self):
        status, created = self._post("other", "Custom Reader")
        assert status == 201
        assert created[0].delivery_tier == DeliveryTier.D


# ---------------------------------------------------------------------------
# GET /api/v1/sources
# ---------------------------------------------------------------------------

class TestListSources:
    def test_returns_sources(self):
        sources = [_fake_source()]

        class FakeResult:
            def scalars(self):
                return MagicMock(all=MagicMock(return_value=sources))

        async def fake_db():
            db = AsyncMock()
            db.execute = AsyncMock(return_value=FakeResult())
            yield db

        from ferry_agent.api.deps import CurrentUser as CU, get_current_user
        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)
        try:
            with patch(
                "ferry_agent.api.sources.ensure_default_sources",
                new_callable=AsyncMock,
            ):
                with TestClient(app) as client:
                    resp = client.get("/api/v1/sources")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["type"] == "gutenberg"
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /api/v1/users/me  +  PATCH /api/v1/users/me
# ---------------------------------------------------------------------------

class TestUsersMe:
    def test_get_me(self):
        user = _fake_user()

        async def fake_db():
            db = AsyncMock()
            db.get = AsyncMock(return_value=user)
            yield db

        from ferry_agent.api.deps import CurrentUser as CU, get_current_user
        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = client.get("/api/v1/users/me")
            assert resp.status_code == 200
            data = resp.json()
            assert data["email"] == _USER_EMAIL
            assert data["default_format"] == "epub"
        finally:
            app.dependency_overrides.clear()

    def test_patch_me_kindle_email(self):
        user = _fake_user()

        async def fake_db():
            db = AsyncMock()
            db.get = AsyncMock(return_value=user)
            db.commit = AsyncMock()
            db.refresh = AsyncMock()
            yield db

        from ferry_agent.api.deps import CurrentUser as CU, get_current_user
        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = client.patch("/api/v1/users/me", json={"kindle_email": "me@kindle.com"})
            assert resp.status_code == 200
            assert user.kindle_email == "me@kindle.com"
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# X-API-Key — chemin compte-service supprimé (W-04)
# ---------------------------------------------------------------------------

class TestXApiKeyAuth:
    def test_api_key_alone_returns_401(self):
        """Un X-API-Key arbitraire sans Authorization doit renvoyer 401."""
        async def fake_db():
            db = AsyncMock()
            yield db

        from ferry_agent.db import get_db

        app.dependency_overrides[get_db] = fake_db
        try:
            with TestClient(app) as client:
                resp = client.get("/api/v1/books", headers={"X-API-Key": "arbitrary-key"})
            assert resp.status_code == 401
        finally:
            app.dependency_overrides.clear()
