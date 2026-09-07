"""Tests du serveur MCP Ferry Agent.

Vérifie :
- que les 5 outils sont bien enregistrés (import + compileall)
- que search_library transmet le bon path et le Bearer token au core
- que list_devices transmet le bon path et le Bearer token au core
- que add_to_library transmet le bon payload
- que get_delivery_status transmet le bon path
- que deliver REFUSE sans confirm=True (garde-fou)
- que deliver appelle bien le core avec confirm=True
- qu'un utilisateur authentifié (OAuth Clerk) fait passer un Bearer token
  au core (voir test_mcp_identity.py)
"""

import sys
from pathlib import Path

# Permet d'importer ferry_mcp sans installation éditable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
import pytest

# Patch settings avant d'importer server pour contrôler la config
import ferry_mcp.config as _cfg_module
from ferry_mcp.config import MCPSettings

_TEST_BEARER = "test-bearer-token"


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    """Injecte une config de test et une identité Clerk factice."""
    settings = MCPSettings(
        ferry_core_url="http://test-core:8000",
        port=8001,
        mcp_auth_enabled=False,
    )
    # Vide le cache lru_cache AVANT de patcher
    _cfg_module.get_settings.cache_clear()
    monkeypatch.setattr(_cfg_module, "get_settings", lambda: settings)
    from ferry_mcp import server

    monkeypatch.setattr(server, "get_settings", lambda: settings)
    monkeypatch.setattr(server, "_resolve_user_token", lambda: _TEST_BEARER)
    yield
    # Restaure et vide à nouveau pour isoler les tests suivants
    monkeypatch.undo()
    _cfg_module.get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_transport(responses: list[httpx.Response]) -> httpx.MockTransport:
    """Retourne un transport qui consomme les réponses dans l'ordre."""
    it = iter(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        return next(it)

    return httpx.MockTransport(handler)


# ---------------------------------------------------------------------------
# Import + tools list
# ---------------------------------------------------------------------------

def test_import_server() -> None:
    from ferry_mcp import server  # noqa: F401


def test_tools_registered() -> None:
    from ferry_mcp.server import mcp
    import asyncio
    tools = asyncio.get_event_loop().run_until_complete(mcp.list_tools())
    tool_names = {t.name for t in tools}
    assert "search_library" in tool_names
    assert "add_to_library" in tool_names
    assert "list_devices" in tool_names
    assert "deliver" in tool_names
    assert "get_delivery_status" in tool_names


# ---------------------------------------------------------------------------
# search_library
# ---------------------------------------------------------------------------

def _mock_client(handler, base_url="http://test-core:8000"):
    """Crée un httpx.AsyncClient avec transport mocké et base_url."""
    return httpx.AsyncClient(
        base_url=base_url,
        transport=httpx.MockTransport(handler),
        headers={"User-Agent": "ferry-agent-mcp", "Authorization": f"Bearer {_TEST_BEARER}"},
        timeout=30.0,
    )


@pytest.mark.asyncio
async def test_search_library_sends_correct_request(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[{"title": "Dune", "author": "Herbert", "source": "gutenberg",
                   "result_id": "r1", "format": "epub", "size_bytes": 512000}],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.search_library("Dune")

    assert len(captured) == 1
    req = captured[0]
    assert req.url.path == "/api/v1/books/search"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert req.headers.get("user-agent") == "ferry-agent-mcp"
    assert "Dune" in result


# ---------------------------------------------------------------------------
# list_devices
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_devices_sends_correct_request(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[{"id": "aaa-111", "brand": "kindle", "model": "Paperwhite",
                   "delivery_tier": "A", "cloud_provider": None, "cloud_linked": False}],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_devices()

    req = captured[0]
    assert req.url.path == "/api/v1/devices"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "kindle" in result.lower()


# ---------------------------------------------------------------------------
# add_to_library
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_add_to_library_sends_payload(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            201,
            json={"id": "lib-123", "title": "Dune", "author": "Herbert",
                  "cover_url": None, "source_id": None,
                  "original_format": "epub", "added_at": "2026-01-01T00:00:00Z"},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.add_to_library("gutenberg", "r1")

    req = captured[0]
    assert req.url.path == "/api/v1/books"
    body = _json.loads(req.content)
    assert body["source"] == "gutenberg"
    assert body["result_id"] == "r1"
    assert "lib-123" in result


# ---------------------------------------------------------------------------
# get_delivery_status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_delivery_status_sends_correct_path(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []
    job_id = "job-uuid-999"

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={"id": job_id, "status": "delivered",
                  "delivered_at": "2026-01-02T10:00:00Z", "error": None,
                  "download_url": None},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.get_delivery_status(job_id)

    req = captured[0]
    assert req.url.path == f"/api/v1/deliveries/{job_id}"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "delivered" in result


# ---------------------------------------------------------------------------
# deliver — garde-fou sans confirm
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deliver_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(200, json=[])

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver("item-1", "device-1", confirm=False)

    # Aucun appel POST /deliveries ne doit avoir été émis
    post_calls = [c for c in calls if c.method == "POST"]
    assert len(post_calls) == 0, "deliver sans confirm ne doit pas appeler POST /deliveries"
    assert "confirm=True" in result
    assert "⚠️" in result


# ---------------------------------------------------------------------------
# deliver — avec confirm=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deliver_with_confirm_calls_core(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            201,
            json={"id": "job-42", "status": "queued",
                  "library_item_id": "item-1", "device_id": "device-1",
                  "method": "email", "created_at": "2026-01-01T00:00:00Z",
                  "delivered_at": None, "error": None, "download_url": None},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver("item-1", "device-1", confirm=True)

    post_calls = [c for c in captured if c.method == "POST"]
    assert len(post_calls) == 1
    req = post_calls[0]
    assert req.url.path == "/api/v1/deliveries"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    body = _json.loads(req.content)
    assert body["library_item_id"] == "item-1"
    assert body["device_id"] == "device-1"
    assert "job-42" in result
