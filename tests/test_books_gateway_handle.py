"""Contrat HTTP : affichage gateway sans liens et références stables."""

import hashlib
import json
import uuid
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from ferry_agent.api import books
from ferry_agent.main import app
from ferry_agent.models import GatewayJobStatus
from ferry_agent.schemas import Result
from tests.fakes import FakeSession, clear_app_deps, override_app_deps

GATEWAY_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
SOURCE = f"gateway:{GATEWAY_ID}"
# Valeur factice : aucune clé réelle dans ces tests.
URL = "https://c411.org/api?t=get&id=test-book&apikey=test-only-not-a-secret"
STORED = Result(
    source=SOURCE,
    result_id=URL,
    guid=URL,
    download_url="http://indexer.test/download?apikey=test-only-not-a-secret",
    magnet_url="magnet:?xt=urn:btih:test-only",
    indexer_id=1,
    title="Auteur.-.Titre.FRENCH.2026.[EPUB]-NOTAG",
    author="Auteur inchangé",
    format="epub",
    size_bytes=123456,
    seeders=83,
    isbn="9782266282362",
    language="fr",
    page_count=320,
    cover_url="https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg",
).model_dump(mode="json")
HANDLE = hashlib.sha256(f"{SOURCE}|{URL}".encode()).hexdigest()[:32]
PRIVATE_FIELDS = {"guid", "magnet_url", "download_url", "indexer_id"}
FORBIDDEN = ("apikey=", "c411.org", "magnet:", "http://", "https://")


@pytest.fixture
async def search_client(monkeypatch):
    job = SimpleNamespace(status=GatewayJobStatus.done, payload={"results": [STORED.copy()]})

    async def online(*args):
        return [SimpleNamespace(id=GATEWAY_ID)]

    async def create(*args):
        return job

    async def legal(*args, **kwargs):
        return []

    async def db():
        yield FakeSession()

    monkeypatch.setattr(books.gateway_service, "online_gateways", online)
    monkeypatch.setattr(books.gateway_service, "create_job", create)
    monkeypatch.setattr(books.library, "search_all", legal)
    override_app_deps(db, user_id=uuid.uuid4())
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client, job
    finally:
        clear_app_deps()


async def test_search_serialized_gateway_has_no_private_fields(search_client):
    client, job = search_client
    response = await client.post("/api/v1/books/search", json={"query": "Titre"})
    assert response.status_code == 200
    result = response.json()[0]
    serialized = json.dumps({key: result[key] for key in PRIVATE_FIELDS | {"result_id"} if key in result})
    found = {needle: needle in serialized for needle in FORBIDDEN}
    print(f"1. Sous-chaînes dans les champs de transport sérialisés : {found}")
    assert not any(found.values())
    assert PRIVATE_FIELDS.isdisjoint(result)
    assert result["result_id"] == HANDLE
    assert job.payload["results"] == [STORED]
    print(f"1. Champs retirés : {sorted(PRIVATE_FIELDS)} ; result_id={result['result_id']}")


async def test_gateway_display_and_source_are_unchanged(search_client):
    client, _ = search_client
    response = await client.post("/api/v1/books/search", json={"query": "Titre"})
    assert response.status_code == 200
    result = response.json()[0]
    fields = (
        "title",
        "author",
        "format",
        "size_bytes",
        "seeders",
        "source",
        "isbn",
        "language",
        "page_count",
        "cover_url",
        "description",
    )
    assert {field: result[field] for field in fields} == {field: STORED[field] for field in fields}
    assert result["owned"] is False
    print("2. Affichage identique au stockage : " + json.dumps({field: result[field] for field in fields}))


async def test_gateway_handle_is_stable(search_client):
    client, _ = search_client
    responses = [await client.post("/api/v1/books/search", json={"query": "Titre"}) for _ in range(2)]
    assert all(response.status_code == 200 for response in responses)
    handles = [response.json()[0]["result_id"] for response in responses]
    assert handles == [HANDLE, HANDLE]
    print(f"3. Deux recherches successives : {handles}")


@pytest.mark.parametrize("source", ["gutenberg", "standard_ebooks", "upload"])
async def test_legal_results_are_not_sanitized(search_client, monkeypatch, source):
    client, _ = search_client
    original = Result(source=source, result_id="123", title="Titre légal", download_url="https://legal.test/123")

    async def legal(*args, **kwargs):
        return [original]

    monkeypatch.setattr(books.library, "search_all", legal)
    response = await client.post("/api/v1/books/search", json={"query": "Titre", "scope": ["legal"]})
    assert response.status_code == 200
    assert response.json() == [{**original.model_dump(mode="json"), "owned": False}]
    print(f"7. Source légale inchangée (tous les champs) : {source}")
