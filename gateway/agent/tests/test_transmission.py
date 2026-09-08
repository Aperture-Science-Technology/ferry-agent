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
