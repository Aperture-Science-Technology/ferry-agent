"""Ordre et recouvrement des recherches, sans delais reseau variables."""

import asyncio
import time
import uuid
from types import SimpleNamespace

import pytest

from ferry_agent.api import books
from ferry_agent.api.deps import CurrentUser
from ferry_agent.models import GatewayJobStatus
from ferry_agent.schemas import Result, SearchRequest
from tests.fakes import FakeSession


@pytest.mark.parametrize("legal_delay,gateway_delay", [(0.35, 0.65), (0.65, 0.35)])
async def test_search_jobs_first_and_parallel_with_legal(monkeypatch, legal_delay, gateway_delay):
    created = []
    legal_started = asyncio.Event()
    polling_started = asyncio.Event()
    durations = {}
    gateway = SimpleNamespace(id=uuid.uuid4())
    job = SimpleNamespace(status=GatewayJobStatus.pending, payload={})

    async def legal(query, *, exclude):
        assert created, "les jobs doivent exister avant le premier appel legal"
        legal_started.set()
        await asyncio.wait_for(polling_started.wait(), 1)
        start = time.perf_counter()
        await asyncio.sleep(legal_delay)
        durations["legal"] = time.perf_counter() - start
        return [Result(source="gutenberg", title=query, result_id="1")]

    async def online(*args):
        return [gateway]

    async def create(*args):
        created.append(time.perf_counter())
        return job

    class Session(FakeSession):
        async def refresh(self, value):
            polling_started.set()
            await asyncio.wait_for(legal_started.wait(), 1)
            if time.perf_counter() - created[0] >= gateway_delay:
                value.status = GatewayJobStatus.done
                value.payload = {"results": [{"source": f"gateway:{gateway.id}", "title": "tolkien", "result_id": "2"}]}
                durations["gateway"] = time.perf_counter() - created[0]

    monkeypatch.setattr(books.library, "search_all", legal)
    monkeypatch.setattr(books.gateway_service, "online_gateways", online)
    monkeypatch.setattr(books.gateway_service, "create_job", create)
    monkeypatch.setattr(
        books,
        "get_settings",
        lambda: SimpleNamespace(
            gateway_online_seconds=60,
            gateway_search_wait_seconds=2,
        ),
    )
    start = time.perf_counter()
    results = await books.search_books(
        SearchRequest(query="tolkien"), CurrentUser(uuid.uuid4(), "test@example.test"), Session()
    )
    elapsed = time.perf_counter() - start
    assert [r.source for r in results] == ["gutenberg", f"gateway:{gateway.id}"]
    assert elapsed < max(durations.values()) + 0.2
    print(
        f"recherche controlee: legal={durations['legal']:.3f}s; gateway={durations['gateway']:.3f}s; "
        f"total={elapsed:.3f}s; ordre=legal,gateway"
    )


@pytest.mark.parametrize("scope", [["legal"], ["gateways"], ["gateway:absent"]])
async def test_search_scopes_do_not_start_other_branches(monkeypatch, scope):
    async def legal(query, *, exclude):
        assert scope == ["legal"]
        return [Result(source="gutenberg", title=query, result_id="1")]

    async def online(*args):
        assert scope != ["legal"]
        return [SimpleNamespace(id=uuid.uuid4())] if scope == ["gateway:absent"] else []

    async def create(*args):
        raise AssertionError("aucune gateway selectionnee")

    monkeypatch.setattr(books.library, "search_all", legal)
    monkeypatch.setattr(books.gateway_service, "online_gateways", online)
    monkeypatch.setattr(books.gateway_service, "create_job", create)
    results = await books.search_books(
        SearchRequest(query="tolkien", scope=scope), CurrentUser(uuid.uuid4(), "test@example.test"), FakeSession()
    )
    assert [r.source for r in results] == (["gutenberg"] if scope == ["legal"] else [])
