"""TransmissionClient torrent-add: magnet filename vs HTTP metainfo."""

from __future__ import annotations

import base64
import json

import httpx
import pytest
from ferry_gateway_agent.transmission import TransmissionClient, TransmissionError

_TORRENT_BYTES = b"d8:announce13:http://a.com4:infod4:name4:bookee"
_RPC_URL = "http://transmission.test/transmission/rpc"


def _rpc_success(torrent_id: int = 42) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "result": "success",
            "arguments": {"torrent-added": {"id": torrent_id}},
        },
    )


@pytest.mark.asyncio
async def test_add_magnet_uses_filename() -> None:
    magnet = "magnet:?xt=urn:btih:abc123"
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        assert request.url == _RPC_URL
        return _rpc_success()

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        torrent_id = await transmission.add(magnet, paused=True)

    assert torrent_id == 42
    assert len(captured) == 1
    payload = json.loads(captured[0].content)
    assert payload["method"] == "torrent-add"
    assert payload["arguments"] == {"filename": magnet, "paused": True}
    assert "metainfo" not in payload["arguments"]


@pytest.mark.asyncio
async def test_add_http_url_follows_redirect_and_sends_metainfo() -> None:
    redirecting = "http://indexer.test/download/old.torrent"
    final_url = "http://cdn.test/files/book.torrent"
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.method == "GET" and str(request.url) == redirecting:
            return httpx.Response(301, headers={"Location": final_url})
        if request.method == "GET" and str(request.url) == final_url:
            return httpx.Response(200, content=_TORRENT_BYTES)
        if request.method == "POST" and str(request.url) == _RPC_URL:
            return _rpc_success(99)
        return httpx.Response(500, text=f"unexpected {request.method} {request.url}")

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        torrent_id = await transmission.add(
            redirecting,
            paused=True,
            headers={"X-Api-Key": "prowlarr-key"},
        )

    assert torrent_id == 99
    get_requests = [r for r in captured if r.method == "GET"]
    assert [str(r.url) for r in get_requests] == [redirecting, final_url]
    assert get_requests[0].headers.get("X-Api-Key") == "prowlarr-key"

    rpc_requests = [r for r in captured if r.method == "POST"]
    assert len(rpc_requests) == 1
    payload = json.loads(rpc_requests[0].content)
    assert payload["method"] == "torrent-add"
    arguments = payload["arguments"]
    assert "filename" not in arguments
    assert arguments["paused"] is True
    assert arguments["metainfo"] == base64.b64encode(_TORRENT_BYTES).decode("ascii")


@pytest.mark.asyncio
async def test_add_http_error_raises_transmission_error() -> None:
    bad_url = "http://indexer.test/missing.torrent"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and str(request.url) == bad_url:
            return httpx.Response(404, text="not found")
        return httpx.Response(500, text=f"unexpected {request.method} {request.url}")

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        with pytest.raises(TransmissionError, match="Could not fetch torrent.*404"):
            await transmission.add(bad_url)


@pytest.mark.asyncio
async def test_wait_until_done_ignores_tracker_warning_error_1(caplog):
    import logging

    responses = iter([0.5, 0.75, 1])

    def handler(request):
        return httpx.Response(200, json={"result": "success", "arguments": {"torrents": [{
            "error": 1, "errorString": "tracker warning", "percentDone": next(responses),
        }]}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        with caplog.at_level(logging.WARNING):
            torrent = await transmission.wait_until_done(42, timeout_seconds=1, poll_interval_seconds=0)
    assert torrent["percentDone"] == 1
    assert sum("tracker warning" in record.message for record in caplog.records) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [2, 3])
async def test_wait_until_done_fails_on_local_error_3(error):
    def handler(request):
        return httpx.Response(200, json={"result": "success", "arguments": {"torrents": [{
            "error": error, "errorString": "download failed", "percentDone": 1,
        }]}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        with pytest.raises(TransmissionError, match="download failed"):
            await transmission.wait_until_done(42, timeout_seconds=1)


@pytest.mark.asyncio
async def test_torrent_redirect_does_not_leak_prowlarr_api_key():
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.host == "prowlarr.test":
            return httpx.Response(302, headers={"Location": "https://indexer.test/book.torrent"})
        if request.method == "GET":
            return httpx.Response(200, content=_TORRENT_BYTES)
        return _rpc_success()

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        await transmission.add("https://prowlarr.test/download", headers={"X-Api-Key": "secret"})
    assert requests[0].headers.get("X-Api-Key") == "secret"
    assert requests[1].url.host == "indexer.test"
    assert "X-Api-Key" not in requests[1].headers
    assert "X-Api-Key" not in requests[2].headers
