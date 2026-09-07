"""Test doubles and factories for ferry-gateway-agent (unique module name)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable
from unittest.mock import AsyncMock

import httpx

from ferry_gateway_agent.config import Settings
from ferry_gateway_agent.worker import GatewayAgent


class FakeProwlarr:
    def __init__(self, results: list[dict[str, Any]] | None = None) -> None:
        self.results = results if results is not None else []
        self.queries: list[str] = []

    async def search(self, query: str) -> list[dict[str, Any]]:
        self.queries.append(query)
        return self.results

    async def aclose(self) -> None:
        return None


class FakeTransmission:
    def __init__(self, torrent: dict[str, Any] | None = None) -> None:
        self.torrent_id = 7
        self.torrent = torrent or {}
        self.removed: list[tuple[int, bool]] = []
        self.remove_error: BaseException | None = None
        self.add = AsyncMock(side_effect=self._add)
        self.start = AsyncMock()
        self.wait_until_done = AsyncMock(side_effect=self._wait)

    async def _add(self, magnet_url: str, *, paused: bool = True) -> int:
        return self.torrent_id

    async def _wait(
        self,
        torrent_id: int,
        *,
        timeout_seconds: float,
        poll_interval_seconds: float = 2,
    ) -> dict[str, Any]:
        return self.torrent

    async def remove(self, torrent_id: int, *, delete_local_data: bool = True) -> None:
        self.removed.append((torrent_id, delete_local_data))
        if self.remove_error is not None:
            raise self.remove_error

    async def aclose(self) -> None:
        return None


class FakeVirusTotal:
    def __init__(self, *, error: BaseException | None = None) -> None:
        self.error = error
        self.scanned: list[Path] = []

    async def scan(self, path: Path) -> dict[str, Any] | None:
        self.scanned.append(path)
        if self.error is not None:
            raise self.error
        return {"ok": True}

    async def aclose(self) -> None:
        return None


def make_settings(
    *,
    state_path: Path,
    download_path: Path,
    pairing_token: str | None = None,
    gateway_id: str | None = None,
    gateway_key: str | None = None,
    poll_interval_seconds: float = 0.01,
) -> Settings:
    return Settings(
        _env_file=None,
        platform_url="http://platform.test",
        pairing_token=pairing_token,
        gateway_id=gateway_id,
        gateway_key=gateway_key,
        prowlarr_url="http://prowlarr.test",
        prowlarr_api_key="prowlarr-key",
        transmission_url="http://transmission.test",
        download_path=download_path,
        state_path=state_path,
        poll_interval_seconds=poll_interval_seconds,
        download_timeout_minutes=1,
        transmission_poll_seconds=0.01,
    )


def make_platform_client(
    handler: Callable[[httpx.Request], httpx.Response],
) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="http://platform.test",
    )


def make_agent(
    *,
    settings: Settings,
    handler: Callable[[httpx.Request], httpx.Response] | None = None,
    prowlarr: FakeProwlarr | None = None,
    transmission: FakeTransmission | None = None,
    virustotal: FakeVirusTotal | None = None,
) -> GatewayAgent:
    if handler is None:
        handler = lambda _request: httpx.Response(204)
    return GatewayAgent(
        settings,
        platform_client=make_platform_client(handler),
        prowlarr=prowlarr or FakeProwlarr(),
        transmission=transmission or FakeTransmission(),
        virustotal=virustotal,
    )
