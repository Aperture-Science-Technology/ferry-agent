"""Fetch job: VirusTotal gate, multipart upload, and cleanup-in-finally."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

from agent_testkit import FakeTransmission, FakeVirusTotal, make_agent, make_settings
from ferry_gateway_agent.virustotal import VirusTotalThreatError


def _fetch_payload(magnet: str = "magnet:?xt=urn:btih:abc") -> dict:
    return {"result": {"magnet_url": magnet}}


def _prepare_torrent_file(
    download_root: Path,
    *,
    name: str = "book.pdf",
    content: bytes = b"%PDF-1.4 content",
) -> dict:
    path = download_root / name
    path.write_bytes(content)
    return {
        "downloadDir": str(download_root),
        "files": [
            {
                "name": name,
                "length": len(content),
                "bytesCompleted": len(content),
            }
        ],
    }


@pytest.mark.asyncio
async def test_finally_removes_torrent_even_when_platform_upload_fails(
    state_path: Path,
    download_root: Path,
) -> None:
    torrent = _prepare_torrent_file(download_root)
    transmission = FakeTransmission(torrent=torrent)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/fetch-result"):
            return httpx.Response(500, text="upload failed")
        return httpx.Response(204)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(
        settings=settings,
        handler=handler,
        transmission=transmission,
    )

    with pytest.raises(httpx.HTTPStatusError):
        await agent._handle_fetch(str(uuid4()), _fetch_payload())

    assert transmission.removed == [(transmission.torrent_id, True)]


@pytest.mark.asyncio
async def test_remove_exception_is_logged_and_does_not_mask_original(
    state_path: Path,
    download_root: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    torrent = _prepare_torrent_file(download_root)
    transmission = FakeTransmission(torrent=torrent)
    transmission.remove_error = RuntimeError("cleanup boom")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/fetch-result"):
            return httpx.Response(503, text="upstream down")
        return httpx.Response(204)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(
        settings=settings,
        handler=handler,
        transmission=transmission,
    )

    with caplog.at_level(logging.ERROR), pytest.raises(httpx.HTTPStatusError) as exc_info:
        await agent._handle_fetch(str(uuid4()), _fetch_payload())

    assert exc_info.value.response.status_code == 503
    assert any("Could not clean up torrent" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_file_posted_as_multipart_with_guessed_content_type(
    state_path: Path,
    download_root: Path,
) -> None:
    content = b"%PDF-1.7 ebook bytes"
    torrent = _prepare_torrent_file(download_root, name="novel.pdf", content=content)
    transmission = FakeTransmission(torrent=torrent)
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/fetch-result"):
            captured["content_type"] = request.headers.get("content-type", "")
            captured["body"] = request.content
            captured["path"] = request.url.path
            return httpx.Response(
                200,
                json={"library_item_id": str(uuid4())},
            )
        return httpx.Response(204)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(
        settings=settings,
        handler=handler,
        transmission=transmission,
    )
    job_id = str(uuid4())
    await agent._handle_fetch(job_id, _fetch_payload())

    content_type = str(captured["content_type"])
    body = captured["body"]
    assert isinstance(body, bytes)
    assert content_type.startswith("multipart/form-data")
    assert b"application/pdf" in body
    assert b"novel.pdf" in body
    assert content in body
    assert captured["path"] == f"/api/v1/gateways/jobs/{job_id}/fetch-result"
    assert transmission.removed == [(transmission.torrent_id, True)]


@pytest.mark.asyncio
async def test_virustotal_threat_fails_job_before_upload(
    state_path: Path,
    download_root: Path,
) -> None:
    torrent = _prepare_torrent_file(download_root)
    transmission = FakeTransmission(torrent=torrent)
    virustotal = FakeVirusTotal(
        error=VirusTotalThreatError("flagged: 2 malicious"),
    )
    upload_calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/fetch-result"):
            upload_calls["n"] += 1
            return httpx.Response(200, json={"library_item_id": str(uuid4())})
        return httpx.Response(204)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    agent = make_agent(
        settings=settings,
        handler=handler,
        transmission=transmission,
        virustotal=virustotal,
    )

    with pytest.raises(VirusTotalThreatError, match="flagged"):
        await agent._handle_fetch(str(uuid4()), _fetch_payload())

    assert upload_calls["n"] == 0
    assert len(virustotal.scanned) == 1
    assert transmission.removed == [(transmission.torrent_id, True)]


@pytest.mark.asyncio
async def test_fetch_without_download_reference_raises(
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

    with pytest.raises(ValueError, match="no download reference"):
        await agent._handle_fetch(str(uuid4()), {"result": {}})
