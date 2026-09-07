"""W-29 : detection de fichiers stables dans le dossier partage."""

from __future__ import annotations

import time
from pathlib import Path

import httpx
import pytest

from ferry_gateway_agent.config import Settings
from ferry_gateway_agent.watcher import WatchFolderImporter


@pytest.mark.asyncio
async def test_stable_file_is_uploaded_and_removed(tmp_path: Path) -> None:
    watch = tmp_path / "watch"
    watch.mkdir()
    book = watch / "novel.epub"
    book.write_bytes(b"PK\x03\x04epub-content")

    uploads: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/books/upload"
        assert request.headers.get("X-Gateway-Key") == "gw-key"
        uploads.append(request.url.path)
        return httpx.Response(
            201,
            json={"id": "00000000-0000-0000-0000-000000000001", "title": "novel"},
        )

    transport = httpx.MockTransport(handler)
    settings = Settings(
        _env_file=None,
        platform_url="http://platform.test",
        gateway_key="gw-key",
        prowlarr_api_key="x",
        watch_path=watch,
        watch_stable_seconds=0.01,
        watch_poll_seconds=0.01,
    )

    async with httpx.AsyncClient(transport=transport) as client:
        importer = WatchFolderImporter(
            settings,
            platform=client,
            gateway_headers={"X-Gateway-Key": "gw-key"},
        )
        assert await importer.poll_once() == 0
        time.sleep(0.02)
        assert await importer.poll_once() == 1

    assert uploads == ["/api/v1/books/upload"]
    assert not book.exists()
