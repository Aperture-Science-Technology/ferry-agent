"""Fetch job: VirusTotal gate, multipart upload, and cleanup-in-finally."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from agent_testkit import FakeTransmission as BaseFakeTransmission
from agent_testkit import FakeVirusTotal, make_agent, make_settings
from ferry_gateway_agent.archives import ArchiveError
from ferry_gateway_agent.transmission import TransmissionError
from ferry_gateway_agent.virustotal import VirusTotalThreatError
from ferry_gateway_agent.worker import _is_terminal_failure


class FakeTransmission(BaseFakeTransmission):
    async def remove(self, torrent_id: int, *, delete_local_data: bool = True) -> None:
        await super().remove(torrent_id, delete_local_data=delete_local_data)
        if delete_local_data:
            for file in self.torrent.get("files", []):
                (Path(self.torrent["downloadDir"]) / file["name"]).unlink(missing_ok=True)


@pytest.mark.parametrize(
    "error, terminal",
    [
        (VirusTotalThreatError("flagged"), True),
        (ArchiveError("unsafe archive"), True),
        (FileNotFoundError("no ebook"), True),
        (httpx.TransportError("transport failed"), False),
        (httpx.HTTPError("request failed"), False),
        (OSError("disk unavailable"), False),
        (TimeoutError("download interrupted"), False),
        (TransmissionError("tracker unavailable"), False),
        (RuntimeError("unexpected failure"), False),
        (BaseException("interrupted"), False),
        (asyncio.CancelledError(), False),
    ],
)
def test_is_terminal_failure(error, terminal):
    assert _is_terminal_failure(error) is terminal


@pytest.mark.parametrize("status", [301, 400, 404, 409, 413, 422, 499, 500, 503, 599])
def test_is_terminal_failure_http_status(status):
    request = httpx.Request("POST", "http://platform.test/fetch-result")
    error = httpx.HTTPStatusError("upload failed", request=request, response=httpx.Response(status))
    assert _is_terminal_failure(error) is (status < 500)


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
async def test_transient_upload_failure_keeps_torrent_and_data(
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

    assert transmission.removed == []
    assert (download_root / "book.pdf").exists()


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
            return httpx.Response(200)
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

    with caplog.at_level(logging.ERROR):
        await agent._handle_fetch(str(uuid4()), _fetch_payload())

    assert transmission.removed == [(transmission.torrent_id, True)]
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
    assert not (download_root / "book.pdf").exists()


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


def _release_agent(state_path, download_root, files, *, status=200):
    torrent = {"downloadDir": str(download_root), "files": []}
    for name, content in files.items():
        path = download_root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        torrent["files"].append(
            {"name": name, "length": len(content), "bytesCompleted": len(content)}
        )
    transmission = FakeTransmission(torrent=torrent)
    uploads = []

    def handler(request):
        assert request.url.path.endswith("/fetch-result")
        uploads.append(request.content)
        return httpx.Response(status)

    agent = make_agent(
        settings=make_settings(
            state_path=state_path, download_path=download_root,
            gateway_id="gw-1", gateway_key="gw-key",
        ),
        handler=handler, transmission=transmission,
    )
    return agent, transmission, uploads


async def test_multi_file_release_uploads_ebook_not_largest_file(state_path, download_root):
    agent, _, uploads = _release_agent(
        state_path, download_root, {"release/book.epub": b"ebook", "release/extra.bin": b"x" * 100}
    )
    await agent._handle_fetch("job", _fetch_payload())
    assert len(uploads) == 1
    assert b'filename="book.epub"' in uploads[0]
    assert b"extra.bin" not in uploads[0]


async def test_non_ebook_only_release_raises_without_upload(state_path, download_root):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"extra.bin": b"extra"})
    with pytest.raises(FileNotFoundError, match=r"extra.bin.*\.epub.*\.pdf"):
        await agent._handle_fetch("job", _fetch_payload())
    assert uploads == []
    assert transmission.removed == [(transmission.torrent_id, True)]
    assert not (download_root / "extra.bin").exists()


def _zip_bytes():
    from io import BytesIO
    from zipfile import ZipFile

    contents = BytesIO()
    with ZipFile(contents, "w") as archive:
        archive.writestr("release/book.epub", b"ebook from zip")
        archive.writestr("release/extra.bin", b"x" * 100)
    return contents.getvalue()


@pytest.mark.parametrize("status", [200, 422, 500])
async def test_zip_release_is_extracted_and_epub_uploaded(state_path, download_root, status):
    agent, transmission, uploads = _release_agent(
        state_path, download_root, {"pack.zip": _zip_bytes()}, status=status
    )
    if status >= 400:
        with pytest.raises(httpx.HTTPStatusError):
            await agent._handle_fetch("job", _fetch_payload())
    else:
        await agent._handle_fetch("job", _fetch_payload())
    assert transmission.removed == ([] if status >= 500 else [(transmission.torrent_id, True)])
    assert (download_root / "pack.zip").exists() is (status >= 500)
    assert len(uploads) == 1
    assert b'filename="book.epub"' in uploads[0]
    assert b"ebook from zip" in uploads[0]
    assert b"extra.bin" not in uploads[0]
    assert not list(download_root.glob(".ferry-extract-*"))
    assert agent._extraction_dir is None


async def test_rar_release_is_refused_without_upload(state_path, download_root):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"pack.rar": b"rar"})
    with pytest.raises(ArchiveError, match="pack.rar"):
        await agent._handle_fetch("job", _fetch_payload())
    assert uploads == []
    assert transmission.removed == [(transmission.torrent_id, True)]
    assert not (download_root / "pack.rar").exists()


async def test_terminal_upload_failure_removes_torrent_and_data(state_path, download_root, caplog):
    agent, transmission, _ = _release_agent(
        state_path, download_root, {"book.epub": b"ebook"}, status=422
    )
    with caplog.at_level(logging.WARNING), pytest.raises(httpx.HTTPStatusError):
        await agent._handle_fetch("job", _fetch_payload())
    assert transmission.removed == [(transmission.torrent_id, True)]
    assert not (download_root / "book.epub").exists()
    assert "retained for retry" not in caplog.text


async def test_no_ebook_in_completed_data_removes_torrent(state_path, download_root):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"readme.txt": b"no book"})
    with pytest.raises(FileNotFoundError):
        await agent._handle_fetch("job", _fetch_payload())
    assert transmission.removed == [(transmission.torrent_id, True)]
    assert not (download_root / "readme.txt").exists()
    assert uploads == []


async def test_timeout_keeps_torrent_and_data(state_path, download_root, caplog):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"book.epub": b"partial"})
    transmission.wait_until_done.side_effect = TimeoutError("download interrupted")
    with caplog.at_level(logging.WARNING), pytest.raises(TimeoutError, match="download interrupted"):
        await agent._handle_fetch("job", _fetch_payload())
    assert transmission.removed == []
    assert (download_root / "book.epub").read_bytes() == b"partial"
    assert uploads == []
    assert f"Torrent {transmission.torrent_id} and local data retained for retry" in caplog.text


@pytest.mark.parametrize(
    "error",
    [
        httpx.TransportError("transport failed"),
        httpx.HTTPError("request failed"),
        OSError("disk unavailable"),
        TransmissionError("tracker unavailable"),
        RuntimeError("unexpected failure"),
        BaseException("interrupted"),
        asyncio.CancelledError(),
    ],
)
async def test_transient_failure_keeps_data_and_cleans_extraction(state_path, download_root, caplog, error):
    archive = _zip_bytes()
    agent, transmission, uploads = _release_agent(state_path, download_root, {"pack.zip": archive})
    agent.virustotal = FakeVirusTotal(error=error)
    with caplog.at_level(logging.WARNING), pytest.raises(type(error)) as exc_info:
        await agent._handle_fetch("job", _fetch_payload())
    assert exc_info.value is error
    assert transmission.removed == []
    assert (download_root / "pack.zip").read_bytes() == archive
    assert uploads == []
    assert not list(download_root.glob(".ferry-extract-*"))
    assert agent._extraction_dir is None
    assert f"Torrent {transmission.torrent_id} and local data retained for retry" in caplog.text


async def test_cleanup_error_preserves_terminal_failure(state_path, download_root, caplog):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"book.epub": b"ebook"})
    error = VirusTotalThreatError("flagged")
    agent.virustotal = FakeVirusTotal(error=error)
    transmission.remove_error = RuntimeError("cleanup boom")
    with caplog.at_level(logging.ERROR), pytest.raises(VirusTotalThreatError) as exc_info:
        await agent._handle_fetch("job", _fetch_payload())
    assert exc_info.value is error
    assert transmission.removed == [(transmission.torrent_id, True)]
    assert uploads == []
    assert "Could not clean up torrent" in caplog.text


async def test_successful_upload_removes_torrent_with_data(state_path, download_root):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"book.epub": b"ebook"})
    await agent._handle_fetch("job", _fetch_payload())
    assert len(uploads) == 1
    assert transmission.removed == [(transmission.torrent_id, True)]


async def test_fetch_uses_download_url_when_no_magnet_or_guid(state_path, download_root):
    agent, transmission, uploads = _release_agent(state_path, download_root, {"book.epub": b"ebook"})
    url = "https://indexer.test/book.torrent"
    await agent._handle_fetch("job", {"result": {"download_url": url}})
    transmission.add.assert_awaited_once_with(url, paused=True)
    assert b'filename="book.epub"' in uploads[0]


@pytest.mark.parametrize("url,key,expected", [
    ("http://prowlarr.test/book.torrent", "secret", {"X-Api-Key": "secret"}),
    ("http://prowlarr.test:80/book.torrent", "secret", {"X-Api-Key": "secret"}),
    ("http://indexer.test/book.torrent", "secret", None),
    ("https://prowlarr.test/book.torrent", "secret", None),
    ("http://prowlarr.test:9696/book.torrent", "secret", None),
    ("http://prowlarr.test/book.torrent", "", None),
])
async def test_prowlarr_api_key_header_only_for_prowlarr_host(state_path, download_root, url, key, expected):
    from unittest.mock import AsyncMock

    agent, transmission, uploads = _release_agent(state_path, download_root, {"book.epub": b"ebook"})
    transmission.add = AsyncMock(return_value=transmission.torrent_id)
    agent.settings.prowlarr_api_key = key
    await agent._handle_fetch("job", {"result": {"download_url": url}})
    assert transmission.add.call_args.args == (url,)
    assert transmission.add.call_args.kwargs.get("headers") == expected
    assert b'filename="book.epub"' in uploads[0]
