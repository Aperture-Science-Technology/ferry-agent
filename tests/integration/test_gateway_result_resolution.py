"""Résolution des références sur PostgreSQL réel, sans accès à la production."""

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from ferry_agent.api import books
from ferry_agent.api.deps import get_current_user
from ferry_agent.config import Settings
from ferry_agent.main import app
from ferry_agent.models import Gateway, GatewayJob, GatewayJobStatus, GatewayJobType, PairingStatus, User
from tests.test_books_gateway_handle import FORBIDDEN, PRIVATE_FIELDS, STORED


@pytest.fixture
async def context(client, db_session, monkeypatch):
    current = app.dependency_overrides[get_current_user]()
    gateway = Gateway(
        user_id=current.id, name="Maison", pairing_status=PairingStatus.paired, last_seen_at=datetime.now(UTC)
    )
    db_session.add(gateway)
    await db_session.commit()
    stored = {**STORED, "source": f"gateway:{gateway.id}"}
    handle = hashlib.sha256(f"{stored['source']}|{stored['result_id']}".encode()).hexdigest()[:32]
    monkeypatch.setattr(books, "get_settings", lambda: Settings(gateway_job_retention_days=7))
    return client, gateway, stored, handle


async def save_job(db, gateway, stored, **overrides):
    values = {
        "gateway_id": gateway.id,
        "type": GatewayJobType.search,
        "status": GatewayJobStatus.done,
        "payload": {"query": "Titre", "results": [stored]},
    }
    db.add(job := GatewayJob(**(values | overrides)))
    await db.commit()
    return job


@pytest.mark.parametrize("body_kind", ["minimal", "display", "multipart"])
async def test_handle_resolves_authentic_result_into_fetch(context, db_session, caplog, body_kind):
    client, gateway, stored, handle = context
    # Ancien à la création mais récemment terminé : même horloge que la purge.
    search = await save_job(db_session, gateway, stored, created_at=datetime.now(UTC) - timedelta(days=30))
    body = {"source": stored["source"], "result_id": handle}
    if body_kind != "minimal":
        body["result"] = {"source": stored["source"], "result_id": handle, "title": "Titre falsifié", "seeders": 999}
    if body_kind == "multipart":
        body["result"] = json.dumps(body["result"])
        response = await client.post("/api/v1/books", files={key: (None, value) for key, value in body.items()})
    else:
        response = await client.post("/api/v1/books", json=body)
    assert all(needle not in json.dumps(body) for needle in FORBIDDEN)
    assert response.status_code == 202, response.text
    fetch = await db_session.get(GatewayJob, uuid.UUID(response.json()["gateway_job_id"]))
    assert fetch.type == GatewayJobType.fetch
    assert fetch.gateway_id == gateway.id
    assert fetch.payload["result"] == stored
    await db_session.refresh(search)
    assert search.payload["results"] == [stored]
    assert all(needle not in response.text for needle in FORBIDDEN)
    assert "test-only-not-a-secret" not in caplog.text
    print(f"4. {body_kind}: HTTP {response.status_code} ; client sans lien ; fetch PostgreSQL = résultat authentique")


@pytest.mark.parametrize(
    "case",
    [
        "unknown",
        "expired",
        "failed",
        "pending",
        "running",
        "fetch",
        "other_gateway",
        "other_user",
        "wrong_source",
        "malformed_result",
        "malformed_results",
        "no_link",
        "revoked",
    ],
)
async def test_handle_cannot_escape_search_scope(context, db_session, case):
    client, gateway, stored, handle = context
    options = {}
    requested_source = stored["source"]
    if case == "unknown":
        handle = "0" * 32
    elif case == "expired":
        options["updated_at"] = datetime.now(UTC) - timedelta(days=8)
    elif case in {"failed", "pending", "running"}:
        options["status"] = GatewayJobStatus(case)
    elif case == "fetch":
        options["type"] = GatewayJobType.fetch
    elif case in {"other_gateway", "other_user"}:
        owner_id = gateway.user_id
        if case == "other_user":
            stranger = User(email=f"stranger-{uuid.uuid4().hex}@example.test")
            db_session.add(stranger)
            await db_session.commit()
            owner_id = stranger.id
        other = Gateway(user_id=owner_id, name="Autre", pairing_status=PairingStatus.paired)
        db_session.add(other)
        await db_session.commit()
        options["gateway_id"] = other.id
        if case == "other_user":
            requested_source = f"gateway:{other.id}"
            stored = {**stored, "source": requested_source}
            handle = hashlib.sha256(f"{requested_source}|{stored['result_id']}".encode()).hexdigest()[:32]
    elif case == "wrong_source":
        stored = {**stored, "source": f"gateway:{uuid.uuid4()}"}
        handle = hashlib.sha256(f"{stored['source']}|{stored['result_id']}".encode()).hexdigest()[:32]
    elif case == "malformed_result":
        stored = {**stored, "title": {"invalid": True}}
    elif case == "malformed_results":
        options["payload"] = {"results": None}
    elif case == "no_link":
        stored = {**stored, **dict.fromkeys(PRIVATE_FIELDS)}
    elif case == "revoked":
        gateway.pairing_status = PairingStatus.revoked
    await save_job(db_session, gateway, stored, **options)
    before = await db_session.scalar(select(func.count()).select_from(GatewayJob))
    response = await client.post("/api/v1/books", json={"source": requested_source, "result_id": handle})
    assert response.status_code == 404, response.text
    if case not in {"other_user", "revoked"}:
        assert "relancez la recherche" in response.json()["detail"].lower()
    after = await db_session.scalar(select(func.count()).select_from(GatewayJob))
    assert before == after
    print(f"5. Inverse {case}: HTTP {response.status_code} ; aucun fetch ; {response.json()['detail']}")


async def test_real_search_response_roundtrip(context, db_session, monkeypatch):
    client, _, stored, handle = context
    real_create_job = books.gateway_service.create_job

    async def complete_search(db, gateway_id, kind, payload):
        job = await real_create_job(db, gateway_id, kind, payload)
        if kind == GatewayJobType.search:
            job.payload = {**payload, "results": [stored]}
            job.status = GatewayJobStatus.done
            await db.commit()
        return job

    monkeypatch.setattr(books.gateway_service, "create_job", complete_search)
    handles = []
    for _ in range(2):
        response = await client.post("/api/v1/books/search", json={"query": "Titre", "scope": ["gateways"]})
        assert response.status_code == 200
        result = response.json()[0]
        handles.append(result["result_id"])
        assert PRIVATE_FIELDS.isdisjoint(result)
        assert result["title"] == stored["title"]
        assert result["source"] == stored["source"]
    assert handles == [handle, handle]
    response = await client.post("/api/v1/books", json={"source": stored["source"], "result_id": handle})
    assert response.status_code == 202
    fetch = await db_session.get(GatewayJob, uuid.UUID(response.json()["gateway_job_id"]))
    assert fetch.payload["result"] == stored
    print("1–4. PostgreSQL réel : deux recherches → référence stable → fetch authentique, sans lien client")
