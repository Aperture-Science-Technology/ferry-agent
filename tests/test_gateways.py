"""Contrats M0.5 testes sans PostgreSQL ni reseau."""

import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile

from ferry_agent.api import books
from ferry_agent.api.deps import CurrentUser, hash_secret
from ferry_agent.api.gateways import submit_fetch_result
from ferry_agent.connectors import Result as LegalResult
from ferry_agent.models import (
    Gateway,
    GatewayJob,
    GatewayJobStatus,
    GatewayJobType,
    PairingStatus,
)
from ferry_agent.schemas import SearchRequest
from ferry_agent.services import gateways
from ferry_agent.services.file_validation import read_limited, sniff_ebook_format

from tests.fakes import FakeSession


def make_gateway(**overrides) -> Gateway:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "name": "Maison",
        "pairing_status": PairingStatus.pending,
        "api_key_hash": hash_secret("gateway-key"),
        "pairing_token_hash": hash_secret("pairing-token"),
        "pairing_expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "pairing_used": False,
    }
    values.update(overrides)
    return Gateway(**values)


async def test_pairing_token_is_one_time() -> None:
    gateway = make_gateway()
    db = FakeSession([gateway, gateway])

    paired = await gateways.pair_gateway(db, "pairing-token")

    assert paired.pairing_status == PairingStatus.paired
    assert paired.pairing_used is True
    assert paired.pairing_token_hash is None
    with pytest.raises(HTTPException) as exc:
        await gateways.pair_gateway(db, "pairing-token")
    assert exc.value.status_code == 400


async def test_pairing_token_ttl_is_enforced() -> None:
    gateway = make_gateway(
        pairing_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
    )
    with pytest.raises(HTTPException) as exc:
        await gateways.pair_gateway(FakeSession([gateway]), "pairing-token")
    assert exc.value.status_code == 400
    assert gateway.pairing_status == PairingStatus.pending


async def test_revoke_invalidates_key_and_cancels_pending_jobs() -> None:
    gateway = make_gateway(pairing_status=PairingStatus.paired)
    db = FakeSession()

    await gateways.revoke_gateway(db, gateway)

    assert gateway.api_key_hash is None
    assert gateway.pairing_status == PairingStatus.revoked
    compiled = str(db.statements[0])
    assert "gateway_jobs" in compiled
    assert "status" in compiled


async def test_poll_moves_pending_job_to_running_and_reposts_running() -> None:
    gateway_id = uuid.uuid4()
    job = GatewayJob(
        id=uuid.uuid4(),
        gateway_id=gateway_id,
        type=GatewayJobType.search,
        payload={"query": "Dune"},
        status=GatewayJobStatus.pending,
    )
    db = FakeSession([job, job])

    assert await gateways.poll_job(db, gateway_id) is job
    assert job.status == GatewayJobStatus.running
    assert await gateways.poll_job(db, gateway_id) is job
    assert db.commits == 1


async def test_fetch_cap_and_magic_bytes() -> None:
    too_large = UploadFile(filename="book.pdf", file=BytesIO(b"%PDF-too-large"))
    with pytest.raises(ValueError, match="volumineux"):
        await read_limited(too_large, 4)

    assert sniff_ebook_format(b"%PDF-1.7") == "pdf"
    assert sniff_ebook_format(b"PK\x03\x04epub") == "epub"
    assert sniff_ebook_format(bytes(60) + b"BOOKMOBI") == "mobi"
    with pytest.raises(ValueError, match="non reconnu"):
        sniff_ebook_format(b"not-an-ebook")


async def test_fetch_result_rejects_bad_magic(monkeypatch: pytest.MonkeyPatch) -> None:
    gateway = make_gateway(pairing_status=PairingStatus.paired)
    job = GatewayJob(
        id=uuid.uuid4(),
        gateway_id=gateway.id,
        type=GatewayJobType.fetch,
        payload={"result": {"title": "Dune"}},
        status=GatewayJobStatus.running,
    )

    async def get_job(*_args, **_kwargs):
        return job

    monkeypatch.setattr("ferry_agent.api.gateways.gateway_service.get_gateway_job", get_job)
    monkeypatch.setattr(
        "ferry_agent.api.gateways.get_settings",
        lambda: SimpleNamespace(max_fetch_bytes=1024, virustotal_api_key=None),
    )
    with pytest.raises(HTTPException) as exc:
        await submit_fetch_result(
            job.id,
            UploadFile(filename="fake.epub", file=BytesIO(b"plain text")),
            gateway,
            FakeSession(),
        )
    assert exc.value.status_code == 422
    assert job.status == GatewayJobStatus.failed


async def test_fetch_result_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    item_id = uuid.uuid4()
    gateway = make_gateway(pairing_status=PairingStatus.paired)
    job = GatewayJob(
        id=uuid.uuid4(),
        gateway_id=gateway.id,
        type=GatewayJobType.fetch,
        payload={},
        status=GatewayJobStatus.done,
        result_ref=str(item_id),
    )

    async def get_job(*_args, **_kwargs):
        return job

    monkeypatch.setattr("ferry_agent.api.gateways.gateway_service.get_gateway_job", get_job)
    result = await submit_fetch_result(
        job.id,
        UploadFile(filename="ignored.pdf", file=BytesIO(b"invalid")),
        gateway,
        FakeSession(),
    )
    assert result.library_item_id == item_id


async def test_search_orchestration_merges_gateway_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gateway = make_gateway(
        pairing_status=PairingStatus.paired,
        last_seen_at=datetime.now(timezone.utc),
    )
    job = GatewayJob(
        id=uuid.uuid4(),
        gateway_id=gateway.id,
        type=GatewayJobType.search,
        payload={"query": "Dune"},
        status=GatewayJobStatus.pending,
    )

    async def legal_search(_query, *, exclude=None):
        return [LegalResult(source="gutenberg", title="Legal", result_id="1")]

    async def online(*_args):
        return [gateway]

    async def create_job(*_args):
        return job

    class SearchSession(FakeSession):
        async def refresh(self, value):
            value.status = GatewayJobStatus.done
            value.payload["results"] = [
                {
                    "source": f"gateway:{gateway.id}",
                    "title": "Dune",
                    "result_id": "magnet:?xt=urn:btih:abc",
                    "magnet_url": "magnet:?xt=urn:btih:abc",
                }
            ]

    monkeypatch.setattr(books.library, "search_all", legal_search)
    monkeypatch.setattr(books.gateway_service, "online_gateways", online)
    monkeypatch.setattr(books.gateway_service, "create_job", create_job)
    monkeypatch.setattr(
        books,
        "get_settings",
        lambda: SimpleNamespace(gateway_online_seconds=60, gateway_search_wait_seconds=0.5),
    )

    results = await books.search_books(
        SearchRequest(query="Dune"),
        CurrentUser(id=gateway.user_id, email="u@example.test"),
        SearchSession(),
    )
    assert [result.source for result in results] == [
        "gutenberg",
        f"gateway:{gateway.id}",
    ]
