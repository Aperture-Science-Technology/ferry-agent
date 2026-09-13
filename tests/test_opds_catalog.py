"""Tests unitaires OPDS : Atom, auth jeton, pagination feed."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from xml.etree import ElementTree as ET

from fastapi.testclient import TestClient

from ferry_agent.api.deps import hash_secret
from ferry_agent.main import app
from ferry_agent.services import opds as opds_service
from tests.fakes import clear_app_deps, override_app_deps

_NOW = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_RAW_TOKEN = "test-opds-token-value-32chars!!"
ATOM = "{http://www.w3.org/2005/Atom}"


def _fake_token(**overrides):
    row = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        label="Liseuse",
        token_hash=hash_secret(_RAW_TOKEN),
        created_at=_NOW,
        last_used_at=None,
        revoked_at=None,
    )
    for key, value in overrides.items():
        setattr(row, key, value)
    return row


def _fake_item(title="Dune", author="Herbert", **overrides):
    item = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        title=title,
        author=author,
        cover_url=None,
        description=None,
        language="en",
        publisher=None,
        original_format="epub",
        storage_path="/tmp/dune.epub",
        added_at=_NOW,
    )
    for key, value in overrides.items():
        setattr(item, key, value)
    return item


def test_build_root_has_nav_entries_and_escapes():
    xml = opds_service.build_root_navigation(_RAW_TOKEN)
    root = ET.fromstring(xml)
    titles = [el.text for el in root.findall(f"{ATOM}entry/{ATOM}title")]
    assert "Ajouts récents" in titles
    assert "Par auteur" in titles
    assert "Tout" in titles


def test_acquisition_feed_escapes_special_chars():
    item = _fake_item(title='Dune & "Messiah" <v1>', author="A <B>")
    xml = opds_service.build_acquisition_feed(
        token=_RAW_TOKEN,
        title="Tout",
        self_href=f"https://example.test/opds/{_RAW_TOKEN}/all?page=1",
        items=[item],
        page=1,
        total=1,
    )
    # ET escape : le XML parse sans erreur et conserve le texte.
    root = ET.fromstring(xml)
    title = root.find(f"{ATOM}entry/{ATOM}title")
    assert title is not None
    assert title.text == 'Dune & "Messiah" <v1>'
    assert b"<v1>" not in xml  # echappe en entite


def test_acquisition_feed_download_and_cover_types():
    item = _fake_item(cover_url="/var/covers/dune.png")
    xml = opds_service.build_acquisition_feed(
        token=_RAW_TOKEN,
        title="Tout",
        self_href=f"https://example.test/opds/{_RAW_TOKEN}/all?page=1",
        items=[item],
        page=1,
        total=1,
    )
    root = ET.fromstring(xml)
    links = {
        link.get("rel"): link
        for link in root.findall(f"{ATOM}entry/{ATOM}link")
    }
    acq = links["http://opds-spec.org/acquisition"]
    assert acq.get("href", "").endswith(f"/download/{item.id}")
    assert acq.get("type") == "application/epub+zip"
    image = links["http://opds-spec.org/image"]
    assert image.get("href", "").endswith(f"/cover/{item.id}")
    assert image.get("type") == "image/png"


def test_pagination_links_next_previous():
    items = [_fake_item(f"Book {i}") for i in range(25)]
    xml = opds_service.build_acquisition_feed(
        token=_RAW_TOKEN,
        title="Tout",
        self_href=f"https://example.test/opds/{_RAW_TOKEN}/all?page=2",
        items=items,
        page=2,
        total=60,
    )
    root = ET.fromstring(xml)
    rels = {
        link.get("rel"): link.get("href")
        for link in root.findall(f"{ATOM}link")
    }
    assert "previous" in rels
    assert "next" in rels
    assert "page=1" in rels["previous"]
    assert "page=3" in rels["next"]


def test_unknown_token_returns_404():
    async def fake_db():
        db = AsyncMock()
        result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        db.execute = AsyncMock(return_value=result)
        yield db

    override_app_deps(fake_db, user_id=_USER_ID)
    try:
        with TestClient(app) as client:
            resp = client.get("/opds/unknown-token")
        assert resp.status_code == 404
    finally:
        clear_app_deps()


def test_revoked_token_returns_404():
    async def resolve(_db, _token):
        return None

    async def fake_db():
        db = AsyncMock()
        yield db

    override_app_deps(fake_db, user_id=_USER_ID)
    try:
        with patch("ferry_agent.api.opds.opds_service.resolve_token", side_effect=resolve):
            with patch("ferry_agent.api.opds.opds_rate_limiter.allow", return_value=True):
                with TestClient(app) as client:
                    resp = client.get(f"/opds/{_RAW_TOKEN}")
        assert resp.status_code == 404
    finally:
        clear_app_deps()


def test_valid_token_returns_atom_navigation():
    token_row = _fake_token()

    async def resolve(_db, raw):
        assert raw == _RAW_TOKEN
        return token_row

    async def fake_db():
        db = AsyncMock()
        yield db

    override_app_deps(fake_db, user_id=_USER_ID)
    try:
        with patch("ferry_agent.api.opds.opds_service.resolve_token", side_effect=resolve):
            with patch("ferry_agent.api.opds.opds_rate_limiter.allow", return_value=True):
                with TestClient(app) as client:
                    resp = client.get(f"/opds/{_RAW_TOKEN}")
        assert resp.status_code == 200
        assert "application/atom+xml" in resp.headers["content-type"]
        assert "opds-catalog" in resp.headers["content-type"]
        assert b"Ajouts" in resp.content
    finally:
        clear_app_deps()


def test_remote_cover_is_proxied_not_redirected(tmp_path: Path):
    token_row = _fake_token()
    item_id = uuid.uuid4()
    cached = tmp_path / "cover.jpg"
    cached.write_bytes(b"\xff\xd8\xff\xd9")

    item = SimpleNamespace(
        id=item_id,
        user_id=_USER_ID,
        cover_url="https://covers.openlibrary.org/b/id/1-L.jpg",
        storage_path=None,
    )

    async def resolve(_db, raw):
        return token_row

    async def fake_db():
        db = AsyncMock()
        result = MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        db.execute = AsyncMock(return_value=result)
        yield db

    override_app_deps(fake_db, user_id=_USER_ID)
    try:
        with patch("ferry_agent.api.opds.opds_service.resolve_token", side_effect=resolve):
            with patch("ferry_agent.api.opds.opds_rate_limiter.allow", return_value=True):
                with patch(
                    "ferry_agent.api.opds.fetch_cover_to_cache",
                    new=AsyncMock(return_value=(cached, "image/jpeg")),
                ):
                    with patch(
                        "ferry_agent.api.opds.validate_cover_url",
                        return_value=item.cover_url,
                    ):
                        with TestClient(app) as client:
                            resp = client.get(
                                f"/opds/{_RAW_TOKEN}/cover/{item_id}",
                                follow_redirects=False,
                            )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("image/jpeg")
        assert b"\xff\xd8" in resp.content
    finally:
        clear_app_deps()


def test_disallowed_remote_cover_returns_404():
    token_row = _fake_token()
    item_id = uuid.uuid4()
    item = SimpleNamespace(
        id=item_id,
        user_id=_USER_ID,
        cover_url="https://evil.example/steal.png",
        storage_path=None,
    )

    async def resolve(_db, raw):
        return token_row

    async def fake_db():
        db = AsyncMock()
        result = MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        db.execute = AsyncMock(return_value=result)
        yield db

    override_app_deps(fake_db, user_id=_USER_ID)
    try:
        with patch("ferry_agent.api.opds.opds_service.resolve_token", side_effect=resolve):
            with patch("ferry_agent.api.opds.opds_rate_limiter.allow", return_value=True):
                with TestClient(app) as client:
                    resp = client.get(
                        f"/opds/{_RAW_TOKEN}/cover/{item_id}",
                        follow_redirects=False,
                    )
        assert resp.status_code == 404
    finally:
        clear_app_deps()
