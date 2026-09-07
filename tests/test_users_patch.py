"""Tests HTTP pour PATCH /api/v1/users/me — champs effacables + validation."""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from ferry_agent.main import app
from tests.fakes import clear_app_deps, override_app_deps

_NOW = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"


def _fake_user(**overrides):
    user = SimpleNamespace(
        id=_USER_ID,
        email=_USER_EMAIL,
        kindle_email="reader@kindle.com",
        default_format="epub",
        created_at=_NOW,
    )
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


def _override(fake_db):
    override_app_deps(fake_db, user_id=_USER_ID, email=_USER_EMAIL)


class TestUsersPatch:
    def test_clears_kindle_email_when_explicitly_null(self):
        user = _fake_user(kindle_email="reader@kindle.com")

        async def fake_db():
            db = AsyncMock()
            db.get = AsyncMock(return_value=user)
            db.commit = AsyncMock()
            db.refresh = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch("/api/v1/users/me", json={"kindle_email": None})
            assert resp.status_code == 200
            assert resp.json()["kindle_email"] is None
            assert user.kindle_email is None
        finally:
            clear_app_deps()

    def test_rejects_malformed_kindle_email(self):
        user = _fake_user()

        async def fake_db():
            db = AsyncMock()
            db.get = AsyncMock(return_value=user)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch(
                    "/api/v1/users/me",
                    json={"kindle_email": "pas-un-email"},
                )
            assert resp.status_code == 422
            assert user.kindle_email == "reader@kindle.com"
        finally:
            clear_app_deps()

    def test_rejects_invalid_default_format(self):
        user = _fake_user()

        async def fake_db():
            db = AsyncMock()
            db.get = AsyncMock(return_value=user)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.patch(
                    "/api/v1/users/me",
                    json={"default_format": "cbz"},
                )
            assert resp.status_code == 422
            assert user.default_format == "epub"
        finally:
            clear_app_deps()
