"""Tests des jetons de telechargement signes et de GET /api/v1/downloads/{token}."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from ferry_agent.main import app
from ferry_agent.services import crypto, download_links
from tests.fakes import clear_app_deps, override_app_deps

TEST_FERNET_KEY = Fernet.generate_key().decode()
_USER_ID = uuid.uuid4()
_OTHER_USER_ID = uuid.uuid4()
_NOW = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
_FIXTURE_EPUB = Path(__file__).resolve().parent / "fixtures" / "minimal.epub"

# Caracteres interdits dans un segment de chemin d'URL.
_PATH_UNSAFE = re.compile(r"[/?#]")


def _settings(**overrides):
    values = {
        "fernet_key": TEST_FERNET_KEY,
        "public_base_url": "https://ferry.example.test",
        "download_link_ttl_seconds": 900,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _patch_crypto(monkeypatch: pytest.MonkeyPatch, **overrides):
    settings = _settings(**overrides)
    monkeypatch.setattr(crypto, "get_settings", lambda: settings)
    return settings


def _fake_item(**overrides):
    item = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        title="Dune",
        author="Herbert",
        cover_url=None,
        source_id=None,
        original_format="epub",
        storage_path=str(_FIXTURE_EPUB),
        added_at=_NOW,
        description=None,
        language=None,
        page_count=None,
        size_bytes=None,
        isbn=None,
        publisher=None,
        published_year=None,
        source_ref=None,
    )
    for key, value in overrides.items():
        setattr(item, key, value)
    return item


# ---------------------------------------------------------------------------
# Service unitaire
# ---------------------------------------------------------------------------


def test_token_is_url_path_safe(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_crypto(monkeypatch)
    token, _expires = download_links.issue_download_token(
        _USER_ID, uuid.uuid4(), "epub", 900
    )
    assert _PATH_UNSAFE.search(token) is None
    assert "+" not in token  # base64url, pas base64 classique
    assert "/" not in token


def test_consume_rejects_foreign_purpose(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_crypto(monkeypatch)
    payload = {
        "purpose": "oauth",
        "user_id": str(_USER_ID),
        "item_id": str(uuid.uuid4()),
        "format": "epub",
        "exp": 9_999_999_999,
    }
    token = crypto.encrypt(json.dumps(payload, separators=(",", ":")))
    with pytest.raises(download_links.DownloadLinkError, match="purpose"):
        download_links.consume_download_token(token)


def test_consume_rejects_expired(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_crypto(monkeypatch)
    token, _ = download_links.issue_download_token(_USER_ID, uuid.uuid4(), "epub", ttl_seconds=1)
    payload = json.loads(crypto.decrypt(token))
    payload["exp"] = 1.0
    expired = crypto.encrypt(json.dumps(payload, separators=(",", ":")))
    with pytest.raises(download_links.DownloadLinkError, match="expire"):
        download_links.consume_download_token(expired)


def test_issue_consume_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_crypto(monkeypatch)
    item_id = uuid.uuid4()
    token, expires_at = download_links.issue_download_token(_USER_ID, item_id, "azw3", 900)
    info = download_links.consume_download_token(token)
    assert info.user_id == _USER_ID
    assert info.item_id == item_id
    assert info.format == "azw3"
    assert abs((info.expires_at - expires_at).total_seconds()) < 2


def test_issue_without_fernet_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(crypto, "get_settings", lambda: SimpleNamespace(fernet_key=None))
    with pytest.raises(download_links.DownloadLinkError):
        download_links.issue_download_token(_USER_ID, uuid.uuid4(), "epub", 900)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


class TestDownloadLinkHttp:
    def test_valid_token_returns_file(self, monkeypatch: pytest.MonkeyPatch) -> None:
        settings = _patch_crypto(monkeypatch)
        from ferry_agent.api import books as books_api

        monkeypatch.setattr(books_api, "get_settings", lambda: settings)

        item = _fake_item()
        assert Path(item.storage_path).is_file()

        async def fake_db():
            db = AsyncMock()
            owned = MagicMock(scalar_one_or_none=MagicMock(return_value=item))
            db.execute = AsyncMock(return_value=owned)
            db.commit = AsyncMock()
            db.refresh = AsyncMock()
            yield db

        override_app_deps(fake_db, user_id=_USER_ID)
        try:
            with TestClient(app) as client:
                issue = client.post(
                    f"/api/v1/books/{item.id}/download-link",
                    json={"format": "epub"},
                )
                assert issue.status_code == 200, issue.text
                data = issue.json()
                assert data["format"] == "epub"
                assert data["url"].startswith("https://ferry.example.test/api/v1/downloads/")
                token = data["url"].rsplit("/", 1)[-1]
                assert _PATH_UNSAFE.search(token) is None

                resp = client.get(f"/api/v1/downloads/{token}")
                assert resp.status_code == 200
                ctype = (resp.headers.get("content-type") or "").lower()
                assert "epub" in ctype or "octet-stream" in ctype or "zip" in ctype
                assert len(resp.content) > 0
        finally:
            clear_app_deps()

    def test_expired_token_returns_404(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_crypto(monkeypatch)
        item_id = uuid.uuid4()
        token, _ = download_links.issue_download_token(_USER_ID, item_id, "epub", 900)
        payload = json.loads(crypto.decrypt(token))
        payload["exp"] = 1.0
        expired = crypto.encrypt(json.dumps(payload, separators=(",", ":")))

        async def fake_db():
            db = AsyncMock()
            db.execute = AsyncMock()
            yield db

        override_app_deps(fake_db, user_id=_USER_ID)
        try:
            with TestClient(app) as client:
                resp = client.get(f"/api/v1/downloads/{expired}")
            assert resp.status_code == 404
            assert resp.json()["detail"] == "introuvable"
        finally:
            clear_app_deps()

    def test_forged_token_returns_404(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_crypto(monkeypatch)

        async def fake_db():
            db = AsyncMock()
            yield db

        override_app_deps(fake_db, user_id=_USER_ID)
        try:
            with TestClient(app) as client:
                resp = client.get("/api/v1/downloads/gAAAAA-not-a-real-token")
            assert resp.status_code == 404
        finally:
            clear_app_deps()

    def test_other_users_book_returns_404(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_crypto(monkeypatch)
        item = _fake_item(user_id=_OTHER_USER_ID)
        token, _ = download_links.issue_download_token(_USER_ID, item.id, "epub", 900)

        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        override_app_deps(fake_db, user_id=_USER_ID)
        try:
            with TestClient(app) as client:
                resp = client.get(f"/api/v1/downloads/{token}")
            assert resp.status_code == 404
        finally:
            clear_app_deps()
