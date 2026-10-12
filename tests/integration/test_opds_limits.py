"""OPDS authentication and atomic quotas against real Postgres."""

import asyncio
import base64
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.models import OpdsToken
from tests.integration.test_opds import _seed_books


@pytest.fixture(autouse=True)
def no_ip_limit(monkeypatch):
    monkeypatch.setattr("ferry_agent.api.opds.opds_rate_limiter.allow", lambda key: True)


async def create(client, **options):
    response = await client.post("/api/v1/opds/tokens", json={"label": "Reader", **options})
    assert response.status_code == 201
    return response.json()


async def test_limits_exposed_and_only_successful_downloads_count(client, db_session, tmp_path):
    token = await create(client, max_downloads=1, expires_in_days=2)
    assert token["max_downloads"] == 1
    assert token["downloads_count"] == 0
    assert token["last_used_at"] is None
    expires = datetime.fromisoformat(token["expires_at"])
    assert timedelta(days=1) < expires - datetime.now(timezone.utc) <= timedelta(days=2)
    user = (await client.get("/api/v1/users/me")).json()
    book = (await _seed_books(db_session, uuid.UUID(user["id"]), 1, tmp_path))[0]
    base = f"/opds/{token['token']}"
    for suffix in [
        "",
        "/all",
        "/recent",
        "/authors",
        "/author?name=Author+0",
        "/search?q=Book",
        "/opensearch.xml",
        f"/cover/{book.id}",
    ]:
        assert (await client.get(base + suffix)).status_code == 200
    assert (await client.get(f"{base}/download/{uuid.uuid4()}")).status_code == 404
    listed = (await client.get("/api/v1/opds/tokens")).json()[0]
    assert listed["downloads_count"] == 0
    assert listed["last_used_at"] is not None
    assert (await client.get(f"{base}/download/{book.id}")).status_code == 200
    assert (await client.get(f"{base}/download/{book.id}")).status_code == 404
    assert (await client.get(base)).status_code == 404
    listed = (await client.get("/api/v1/opds/tokens")).json()[0]
    assert listed["downloads_count"] == listed["max_downloads"] == 1
    assert listed["expires_at"] == token["expires_at"]


@pytest.mark.parametrize("state", ["unknown", "revoked", "expired", "exhausted"])
@pytest.mark.parametrize("basic", [False, True])
async def test_unusable_tokens_always_404(client, db_session, state, basic):
    token = await create(client)
    row = await db_session.get(OpdsToken, uuid.UUID(token["id"]))
    if state == "revoked":
        row.revoked_at = datetime.now(timezone.utc)
    elif state == "expired":
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif state == "exhausted":
        row.max_downloads = 1
        row.downloads_count = 1
    await db_session.commit()
    secret = "unknown" if state == "unknown" else token["token"]
    kwargs = {"auth": ("any-reader", secret)} if basic else {}
    base = "/opds" if basic else f"/opds/{secret}"
    for suffix in [
        "",
        "/all",
        "/recent",
        "/authors",
        "/author?name=x",
        "/search",
        "/opensearch.xml",
        f"/download/{uuid.uuid4()}",
        f"/cover/{uuid.uuid4()}",
    ]:
        response = await client.get(base + suffix, **kwargs)
        assert response.status_code == 404


async def test_basic_auth_links_are_usable_and_contain_no_secret(client, db_session, tmp_path, caplog):
    token = await create(client)
    user = (await client.get("/api/v1/users/me")).json()
    book = (await _seed_books(db_session, uuid.UUID(user["id"]), 1, tmp_path))[0]
    auth = ("nom libre", token["token"])
    for path in [
        "/opds",
        "/opds/",
        "/opds/all",
        "/opds/recent",
        "/opds/authors",
        "/opds/author?name=Author+0",
        "/opds/search?q=Book",
        "/opds/opensearch.xml",
    ]:
        response = await client.get(path, auth=auth)
        assert response.status_code == 200
        assert token["token"] not in response.text
    assert "/opds/download/" in (await client.get("/opds/all", auth=auth)).text
    assert (await client.get(f"/opds/download/{book.id}", auth=auth)).status_code == 200
    assert (await client.get(f"/opds/cover/{book.id}", auth=auth)).status_code == 200
    assert token["token"] not in caplog.text
    encoded = base64.b64encode(f"nom libre:{token['token']}".encode()).decode()
    assert encoded not in caplog.text
    listed = (await client.get("/api/v1/opds/tokens")).json()[0]
    assert listed["downloads_count"] == 1
    assert listed["max_downloads"] is None
    assert listed["expires_at"] is None


@pytest.mark.parametrize("header", ["Basic !!!", "Basic bm9jb2xvbg==", "Basic /w==", "Bearer nope", "Basic "])
async def test_malformed_basic_does_not_fall_back_to_path_token(client, header):
    token = await create(client)
    response = await client.get(f"/opds/{token['token']}", headers={"Authorization": header})
    assert response.status_code == 404


@pytest.mark.parametrize(
    "options",
    [
        {"max_downloads": 0},
        {"max_downloads": -1},
        {"max_downloads": 2**31},
        {"expires_in_days": 0},
        {"expires_in_days": -1},
        {"expires_in_days": 36501},
    ],
)
async def test_invalid_limits_rejected(client, options):
    assert (await client.post("/api/v1/opds/tokens", json=options)).status_code == 422


async def test_parallel_downloads_cannot_exceed_quota(client, db_session, tmp_path):
    token = await create(client, max_downloads=2)
    user = (await client.get("/api/v1/users/me")).json()
    book = (await _seed_books(db_session, uuid.UUID(user["id"]), 1, tmp_path))[0]
    factory = async_sessionmaker(db_session.bind, expire_on_commit=False)
    previous = app.dependency_overrides[get_db]

    async def independent_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = independent_session
    try:
        responses = await asyncio.gather(*[client.get(f"/opds/{token['token']}/download/{book.id}") for _ in range(8)])
    finally:
        app.dependency_overrides[get_db] = previous
    assert sorted(r.status_code for r in responses) == [200, 200, 404, 404, 404, 404, 404, 404]
    db_session.expire_all()
    row = await db_session.get(OpdsToken, uuid.UUID(token["id"]))
    assert row.downloads_count == 2
