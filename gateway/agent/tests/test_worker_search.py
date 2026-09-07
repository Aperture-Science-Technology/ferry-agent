"""Search job handling and poll_once GatewayJobOut contract."""

from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

from agent_testkit import FakeProwlarr, make_agent, make_settings


@pytest.mark.asyncio
async def test_search_payload_without_query_raises(
    state_path: Path,
    download_root: Path,
) -> None:
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings)

    with pytest.raises(ValueError, match="no query"):
        await agent._handle_search(str(uuid4()), {})


@pytest.mark.asyncio
async def test_search_whitespace_query_raises(
    state_path: Path,
    download_root: Path,
) -> None:
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings)

    with pytest.raises(ValueError, match="no query"):
        await agent._handle_search(str(uuid4()), {"query": "   "})


@pytest.mark.asyncio
async def test_search_posts_prowlarr_results_as_is(
    state_path: Path,
    download_root: Path,
) -> None:
    results = [
        {
            "source": "prowlarr",
            "title": "Dune",
            "author": "Herbert",
            "format": "epub",
            "size_bytes": 12,
            "result_id": "magnet:?xt=urn:btih:1",
            "magnet_url": "magnet:?xt=urn:btih:1",
            "indexer_id": 3,
            "guid": None,
            "seeders": 4,
        }
    ]
    prowlarr = FakeProwlarr(results=results)
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if "/search-results" in request.url.path:
            captured["path"] = request.url.path
            captured["headers"] = dict(request.headers)
            captured["json"] = json.loads(request.content.decode())
            return httpx.Response(200, json={"job_id": str(uuid4()), "status": "done"})
        return httpx.Response(204)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings, handler=handler, prowlarr=prowlarr)
    job_id = str(uuid4())
    await agent._handle_search(job_id, {"query": "dune"})

    assert prowlarr.queries == ["dune"]
    assert captured["path"] == f"/api/v1/gateways/jobs/{job_id}/search-results"
    assert captured["json"] == results
    assert captured["headers"]["x-gateway-key"] == "gw-key"


@pytest.mark.asyncio
async def test_poll_once_returns_gateway_job_out(
    state_path: Path,
    download_root: Path,
) -> None:
    job = {
        "job_id": str(uuid4()),
        "type": "search",
        "payload": {"query": "neuromancer"},
        "status": "pending",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/gateways/poll"
        assert request.headers.get("x-gateway-key") == "gw-key"
        return httpx.Response(200, json=job)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings, handler=handler)
    assert await agent.poll_once() == job


@pytest.mark.asyncio
async def test_poll_once_204_returns_none(
    state_path: Path,
    download_root: Path,
) -> None:
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(
        settings=settings,
        handler=lambda _r: httpx.Response(204),
    )
    assert await agent.poll_once() is None


@pytest.mark.asyncio
async def test_poll_once_historical_job_envelope_is_not_unwrapped(
    state_path: Path,
    download_root: Path,
) -> None:
    """Regression: pre-GatewayJobOut envelopes ({"job": ...} / list / jobs[])
    are no longer specially unwrapped — only a bare GatewayJobOut dict is a job.
    """
    inner = {
        "job_id": str(uuid4()),
        "type": "search",
        "payload": {"query": "old"},
        "status": "pending",
    }
    envelope = {"job": inner}

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=envelope)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings, handler=handler)
    polled = await agent.poll_once()
    assert polled == envelope
    assert polled is not inner
    assert polled.get("job_id") is None  # type: ignore[union-attr]


@pytest.mark.asyncio
async def test_handle_job_reads_job_id_serialized_by_core(
    state_path: Path,
    download_root: Path,
) -> None:
    """Core GatewayJobOut serializes `job_id` (validation_alias of ORM `id`).
    `handle_job` still accepts `id` as a dead fallback branch.
    """
    prowlarr = FakeProwlarr(results=[])
    posted: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "/search-results" in request.url.path:
            posted.append(request.url.path)
            return httpx.Response(200, json={"job_id": str(uuid4()), "status": "done"})
        return httpx.Response(204)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings, handler=handler, prowlarr=prowlarr)
    job_id = str(uuid4())
    await agent.handle_job(
        {
            "job_id": job_id,
            "type": "search",
            "payload": {"query": "snow crash"},
            "status": "pending",
        }
    )
    assert posted == [f"/api/v1/gateways/jobs/{job_id}/search-results"]


@pytest.mark.asyncio
async def test_handle_job_without_id_raises(
    state_path: Path,
    download_root: Path,
) -> None:
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings)

    with pytest.raises(ValueError, match="no id"):
        await agent.handle_job({"type": "search", "payload": {"query": "x"}})
