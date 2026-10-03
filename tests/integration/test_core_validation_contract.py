"""Régressions F05–F07 sur les réponses HTTP et la persistance Postgres."""

import json
import uuid
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from ferry_agent.config import Settings
from ferry_agent.main import app
from ferry_agent.models import GatewayJob, LibraryItem, Source
from ferry_agent.services import library


@pytest.fixture
async def book(client, tmp_path, monkeypatch):
    settings = Settings(library_storage_dir=str(tmp_path / "livres"))
    monkeypatch.setattr(library, "get_settings", lambda: settings)
    monkeypatch.setattr("ferry_agent.api.books.get_settings", lambda: settings)

    class Connector:
        async def fetch(self, result_id):
            path = tmp_path / "livre.epub"
            path.write_bytes(b"PK\x03\x04livre")
            return str(path)

    monkeypatch.setattr(library, "get_connector", lambda name: Connector())
    response = await client.post(
        "/api/v1/books",
        json={
            "source": "gutenberg",
            "result_id": "1342",
            "result": {"title": "Livre conservé", "author": "Auteur", "page_count": 12},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("field", ["title", "author", "brand", "default_format"])
async def test_f05_required_null_preserves_value(client, db_session, book, field):
    if field in {"title", "author"}:
        path = f"/api/v1/books/{book['id']}"
    elif field == "brand":
        device = (await client.post("/api/v1/devices", json={"brand": "kindle"})).json()
        path = f"/api/v1/devices/{device['id']}"
    else:
        path = "/api/v1/users/me"
    before = (await client.get(path)).json()
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as http:
        response = await http.patch(path, json={field: None})
    # Libère aussi une transaction échouée dans la version antérieure au correctif.
    await db_session.rollback()
    db_session.expunge_all()
    after = await client.get(path)
    assert after.status_code == 200
    assert after.json()[field] == before[field]
    assert response.status_code == 422, response.text


async def test_f05_clear_and_omit(client, db_session, book):
    path = f"/api/v1/books/{book['id']}"
    assert (await client.patch(path, json={"page_count": 12})).status_code == 200
    assert (await client.patch(path, json={"page_count": None})).status_code == 200
    assert (await client.patch(path, json={})).status_code == 200
    profile = "/api/v1/users/me"
    assert (await client.patch(profile, json={"kindle_email": "lecteur@kindle.com"})).status_code == 200
    assert (await client.patch(profile, json={})).json()["kindle_email"] == "lecteur@kindle.com"
    assert (await client.patch(profile, json={"kindle_email": None})).status_code == 200
    db_session.expunge_all()
    assert (await client.get(path)).json()["page_count"] is None
    assert (await client.get(path)).json()["title"] == book["title"]
    assert (await client.get(profile)).json()["kindle_email"] is None
    assert (await client.get(profile)).json()["default_format"] == "epub"


@pytest.mark.parametrize("body", ["[]", "null", "42", '"livre"', "true", '{"source":', "{}"])
async def test_f06_invalid_body_does_not_mutate(client, db_session, tmp_path, monkeypatch, body):
    settings = Settings(library_storage_dir=str(tmp_path / "livres"))
    monkeypatch.setattr(library, "get_settings", lambda: settings)
    monkeypatch.setattr("ferry_agent.api.books.get_settings", lambda: settings)
    models = (LibraryItem, Source, GatewayJob)
    before = [await db_session.scalar(select(func.count()).select_from(model)) for model in models]
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as http:
        response = await http.post("/api/v1/books", content=body, headers={"content-type": "application/json"})
    after = [await db_session.scalar(select(func.count()).select_from(model)) for model in models]
    assert after == before
    assert list(tmp_path.rglob("*")) == []
    assert 400 <= response.status_code < 500, response.text


async def test_f06_valid_json_and_legacy_multipart(client, db_session, book):
    assert book["title"] == "Livre conservé"
    response = await client.post("/api/v1/books", files={"file": ("ancien.pdf", b"%PDF-1.7 livre", "application/pdf")})
    assert response.status_code == 201, response.text
    assert response.headers["deprecation"] == "true"
    assert response.headers["link"] == '</api/v1/books/upload>; rel="successor-version"'
    db_session.expunge_all()
    item = await db_session.get(LibraryItem, uuid.UUID(response.json()["id"]))
    assert Path(item.storage_path).read_bytes() == b"%PDF-1.7 livre"


def test_f07_published_inputs_and_statuses():
    schema = json.loads(Path("openapi.json").read_text())
    assert schema == app.openapi()
    paths = schema["paths"]
    body = paths["/api/v1/books"]["post"]["requestBody"]["content"]
    assert "source" in body["application/json"]["schema"]["properties"]
    assert "result_id" in body["application/json"]["schema"]["properties"]
    assert "result" in body["application/json"]["schema"]["properties"]
    assert body["multipart/form-data"]["schema"]["properties"]["file"]["format"] == "binary"
    profile = paths["/api/v1/users/me"]["patch"]["requestBody"]["content"]["application/json"]["schema"]
    assert set(profile["properties"]) == {"kindle_email", "default_format"}
    assert "null" not in json.dumps(profile["properties"]["default_format"])
    assert "202" in paths["/api/v1/books"]["post"]["responses"]
    assert "204" in paths["/api/v1/gateways/poll"]["post"]["responses"]


@pytest.mark.parametrize("suffix", ["", "/all", "/recent", "/authors", "/author", "/search", "/opensearch.xml"])
async def test_f07_xml_matches_published_content_type(client, suffix):
    token = (await client.post("/api/v1/opds/tokens", json={})).json()["token"]
    response = await client.get(f"/opds/{token}{suffix}", params={"name": "Auteur"})
    assert response.status_code == 200, response.text
    schema = json.loads(Path("openapi.json").read_text())
    content = schema["paths"][f"/opds/{{token}}{suffix}"]["get"]["responses"]["200"]["content"]
    assert response.headers["content-type"] in content
    assert "application/json" not in content


async def test_f07_gateway_statuses_match_contract(client):
    schema = json.loads(Path("openapi.json").read_text())
    created = await client.post("/api/v1/gateways", json={})
    assert created.status_code == 201, created.text
    credentials = created.json()
    paired = await client.post("/api/v1/gateways/pair", json={"token": credentials["pairing_token"]})
    assert paired.status_code == 200, paired.text
    headers = {"X-Gateway-Key": credentials["gateway_key"]}
    empty = await client.post("/api/v1/gateways/poll", headers=headers)
    assert empty.status_code == 204
    assert empty.content == b""
    poll_responses = schema["paths"]["/api/v1/gateways/poll"]["post"]["responses"]
    assert "content" not in poll_responses[str(empty.status_code)]
    queued = await client.post(
        "/api/v1/books",
        json={
            "source": f"gateway:{credentials['gateway_id']}",
            "result_id": "https://example.test/livre",
            "result": {"title": "Livre distant", "author": "Auteur"},
        },
    )
    assert queued.status_code == 202, queued.text
    declared = schema["paths"]["/api/v1/books"]["post"]["responses"][str(queued.status_code)]
    assert declared["content"]["application/json"]["schema"]["$ref"].endswith("/GatewayFetchQueued")
    running = await client.post("/api/v1/gateways/poll", headers=headers)
    assert running.status_code == 200
    assert running.json()["job_id"] == queued.json()["gateway_job_id"]
    assert running.json()["payload"]["result"]["title"] == "Livre distant"
    assert poll_responses["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/GatewayJobOut"
    }


async def test_f07_binary_content_matches_contract(client, db_session, book, tmp_path, monkeypatch):
    settings = Settings(fernet_key=Fernet.generate_key().decode())
    monkeypatch.setattr("ferry_agent.services.crypto.get_settings", lambda: settings)
    schema = json.loads(Path("openapi.json").read_text())
    item = await db_session.get(LibraryItem, uuid.UUID(book["id"]))
    cover = tmp_path / "couverture.png"
    cover.write_bytes(b"\x89PNG\r\n\x1a\n")
    item.cover_url = "https://www.gutenberg.org/cover.png"
    await db_session.commit()

    async def fetch_cover(*args):
        return cover, "image/png"

    monkeypatch.setattr("ferry_agent.api.covers.fetch_cover_to_cache", fetch_cover)
    monkeypatch.setattr("ferry_agent.api.opds.fetch_cover_to_cache", fetch_cover)
    token = (await client.post("/api/v1/opds/tokens", json={})).json()["token"]
    link = await client.post(f"/api/v1/books/{book['id']}/download-link", json={})
    assert link.status_code == 200, link.text
    routes = [
        (
            f"/opds/{token}/download/{book['id']}",
            "/opds/{token}/download/{item_id}",
            Path(item.storage_path).read_bytes(),
        ),
        (f"/opds/{token}/cover/{book['id']}", "/opds/{token}/cover/{item_id}", cover.read_bytes()),
        (f"/api/v1/covers/{book['id']}", "/api/v1/covers/{item_id}", cover.read_bytes()),
        (link.json()["url"], "/api/v1/downloads/{token}", Path(item.storage_path).read_bytes()),
    ]
    for url, path, expected in routes:
        response = await client.get(url)
        assert response.status_code == 200, response.text
        assert response.content == expected
        declared = schema["paths"][path]["get"]["responses"]["200"]["content"]
        assert declared[response.headers["content-type"]]["schema"] == {"type": "string", "format": "binary"}
        assert "application/json" not in declared
