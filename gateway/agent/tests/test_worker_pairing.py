"""Pairing one-shot, atomic state persistence, and PlatformConflict retries."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx
import pytest

from agent_testkit import make_agent, make_settings
from ferry_gateway_agent.worker import PlatformConflict


@pytest.mark.asyncio
async def test_pairing_token_without_gateway_key_raises(
    state_path: Path,
    download_root: Path,
) -> None:
    """Documents the W-24 tutorial bug: PAIRING_TOKEN alone is not enough."""
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        pairing_token="pair-token",
        gateway_key=None,
    )
    agent = make_agent(settings=settings)

    with pytest.raises(
        RuntimeError,
        match="GATEWAY_KEY must accompany PAIRING_TOKEN on first use",
    ):
        await agent.pair()


@pytest.mark.asyncio
async def test_successful_pairing_writes_state_atomically_with_mode_600(
    state_path: Path,
    download_root: Path,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/gateways/pair"
        body = json.loads(request.content.decode())
        assert body == {"pairing_token": "pair-token"}
        return httpx.Response(
            200,
            json={"gateway_id": "gw-42", "gateway_key": "rotated-key"},
        )

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        pairing_token="pair-token",
        gateway_key="initial-key",
    )
    agent = make_agent(settings=settings, handler=handler)
    await agent.pair()

    assert agent.gateway_id == "gw-42"
    assert agent.gateway_key == "rotated-key"
    assert state_path.is_file()
    assert state_path.stat().st_mode & 0o777 == 0o600
    assert not state_path.with_suffix(state_path.suffix + ".tmp").exists()
    assert json.loads(state_path.read_text(encoding="utf-8")) == {
        "gateway_id": "gw-42",
        "gateway_key": "rotated-key",
    }


@pytest.mark.asyncio
async def test_gateway_id_present_without_gateway_key_raises(
    state_path: Path,
    download_root: Path,
) -> None:
    state_path.write_text(
        json.dumps({"gateway_id": "gw-1"}),
        encoding="utf-8",
    )
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id=None,
        gateway_key=None,
    )
    agent = make_agent(settings=settings)

    with pytest.raises(RuntimeError, match="GATEWAY_KEY is required for a paired gateway"):
        await agent.pair()


@pytest.mark.asyncio
async def test_pairing_409_raises_platform_conflict(
    state_path: Path,
    download_root: Path,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, text="pairing token already used")

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        pairing_token="pair-token",
        gateway_key="gw-key",
    )
    agent = make_agent(settings=settings, handler=handler)

    with pytest.raises(PlatformConflict, match="HTTP 409"):
        await agent.pair()


@pytest.mark.asyncio
async def test_run_retries_pairing_on_409_without_crashing(
    state_path: Path,
    download_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pair_attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/pair"):
            pair_attempts["n"] += 1
            if pair_attempts["n"] == 1:
                return httpx.Response(409, text="conflict")
            return httpx.Response(200, json={"gateway_id": "gw-ok"})
        if request.url.path.endswith("/poll"):
            return httpx.Response(204)
        return httpx.Response(500, text=f"unexpected {request.url.path}")

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        pairing_token="pair-token",
        gateway_key="gw-key",
        poll_interval_seconds=0.01,
    )
    agent = make_agent(settings=settings, handler=handler)

    sleeps = {"n": 0}

    async def fake_sleep(_seconds: float) -> None:
        sleeps["n"] += 1
        if agent.gateway_id and sleeps["n"] >= 2:
            raise asyncio.CancelledError()

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    with pytest.raises(asyncio.CancelledError):
        await agent.run()

    assert pair_attempts["n"] >= 2
    assert agent.gateway_id == "gw-ok"
    assert state_path.is_file()


@pytest.mark.asyncio
async def test_already_paired_gateway_persists_state_without_platform_call(
    state_path: Path,
    download_root: Path,
) -> None:
    called = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        called["n"] += 1
        return httpx.Response(500)

    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-existing",
        gateway_key="key-existing",
    )
    agent = make_agent(settings=settings, handler=handler)
    await agent.pair()

    assert called["n"] == 0
    assert json.loads(state_path.read_text(encoding="utf-8")) == {
        "gateway_id": "gw-existing",
        "gateway_key": "key-existing",
    }
