"""W-33 : allowlist cover_url + proxy /api/v1/covers/{item_id}."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import Settings
from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.models import GatewayJob, GatewayJobStatus, GatewayJobType
from ferry_agent.schemas import Result
from ferry_agent.services import covers as covers_service
from ferry_agent.services import gateways as gateway_service
from ferry_agent.services.covers import validate_cover_url

_USER_ID = uuid.uuid4()
_USER_EMAIL = "covers@example.com"


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg", True),
        ("https://gutenberg.org/cache/epub/1/pg1.cover.medium.jpg", True),
        ("https://standardebooks.org/images/covers/jane-austen_pride.jpg", True),
        ("https://covers.openlibrary.org/b/id/123-L.jpg", True),
        ("http://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg", False),
        ("https://evil.example/cover.jpg", False),
        ("https://openlibrary.org/b/id/123-L.jpg", False),
        ("https://user:pass@www.gutenberg.org/x.jpg", False),
        ("", False),
        (None, False),
    ],
)
def test_validate_cover_url(url, expected) -> None:
    got = validate_cover_url(url)
    if expected:
        assert got == url
    else:
        assert got is None


@pytest.mark.asyncio
async def test_save_search_results_strips_disallowed_cover_url() -> None:
    job = GatewayJob(
        id=uuid.uuid4(),
        gateway_id=uuid.uuid4(),
        type=GatewayJobType.search,
        payload={"query": "Dune"},
        status=GatewayJobStatus.running,
    )
    db = AsyncMock()
    db.commit = AsyncMock()

    results = [
        Result(
            source="gateway:x",
            title="Good",
            result_id="1",
            cover_url="https://covers.openlibrary.org/b/id/1-L.jpg",
        ),
        Result(
            source="gateway:x",
            title="Bad",
            result_id="2",
            cover_url="https://evil.example/x.jpg",
        ),
        Result(
            source="gateway:x",
            title="Http",
            result_id="3",
            cover_url="http://www.gutenberg.org/x.jpg",
        ),
    ]

    saved = await gateway_service.save_search_results(db, job, results)
    stored = saved.payload["results"]
    assert stored[0]["cover_url"] == "https://covers.openlibrary.org/b/id/1-L.jpg"
    assert stored[1]["cover_url"] is None
    assert stored[2]["cover_url"] is None


def _patch_async_client(transport: httpx.MockTransport):
    real_client = httpx.AsyncClient(transport=transport, follow_redirects=True)

    class _CM:
        async def __aenter__(self):
            return real_client

        async def __aexit__(self, *args):
            await real_client.aclose()

    return patch("ferry_agent.services.covers.httpx.AsyncClient", return_value=_CM())


@pytest.mark.asyncio
async def test_fetch_cover_to_cache_rejects_non_image(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(temp_dir=str(tmp_path))
    monkeypatch.setattr(covers_service, "get_settings", lambda: settings)

    url = "https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            content=b"<html>nope</html>",
            request=request,
        )

    with _patch_async_client(httpx.MockTransport(handler)):
        with pytest.raises(ValueError, match="Content-Type"):
            await covers_service.fetch_cover_to_cache(str(uuid.uuid4()), url)


@pytest.mark.asyncio
async def test_fetch_cover_to_cache_stores_image(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(temp_dir=str(tmp_path))
    monkeypatch.setattr(covers_service, "get_settings", lambda: settings)

    url = "https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg"
    jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 64

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "image/jpeg"},
            content=jpeg,
            request=request,
        )

    with _patch_async_client(httpx.MockTransport(handler)):
        path, media = await covers_service.fetch_cover_to_cache(str(uuid.uuid4()), url)

    assert media == "image/jpeg"
    assert path.exists()
    assert path.read_bytes() == jpeg


def test_get_cover_endpoint_serves_cached_file(tmp_path) -> None:
    item_id = uuid.uuid4()
    cover_url = "https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg"
    item = SimpleNamespace(
        id=item_id,
        user_id=_USER_ID,
        cover_url=cover_url,
    )
    jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 32

    async def fake_db():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none = MagicMock(return_value=item)
        session.execute = AsyncMock(return_value=result)
        yield session

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=_USER_ID, email=_USER_EMAIL
    )

    async def fake_fetch(item_id_str: str, url: str):
        dest = tmp_path / "covers" / f"{item_id_str}.jpg"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(jpeg)
        return dest, "image/jpeg"

    try:
        with patch(
            "ferry_agent.api.covers.fetch_cover_to_cache",
            side_effect=fake_fetch,
        ):
            with TestClient(app) as client:
                resp = client.get(f"/api/v1/covers/{item_id}")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("image/jpeg")
        assert resp.content == jpeg
    finally:
        app.dependency_overrides.clear()


def test_get_cover_endpoint_404_when_disallowed_url() -> None:
    item_id = uuid.uuid4()
    item = SimpleNamespace(
        id=item_id,
        user_id=_USER_ID,
        cover_url="https://evil.example/x.jpg",
    )

    async def fake_db():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none = MagicMock(return_value=item)
        session.execute = AsyncMock(return_value=result)
        yield session

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=_USER_ID, email=_USER_EMAIL
    )
    try:
        with TestClient(app) as client:
            resp = client.get(f"/api/v1/covers/{item_id}")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()
