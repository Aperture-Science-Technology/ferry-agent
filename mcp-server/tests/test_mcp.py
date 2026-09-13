"""Tests du serveur MCP Ferry Agent.

Vérifie :
- que les outils critiques sont enregistrés
- que search_library / list_library / list_devices / list_gateways
  transmettent path + Bearer au core
- que add_to_library et deliver envoient le bon payload (method incluse)
- que deliver REFUSE sans confirm=True (garde-fou)
- que les erreurs core (401/404) sont actionnables et stables
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

def _mock_client(handler, base_url="http://test-core:8000"):
    """Crée un httpx.AsyncClient avec transport mocké et base_url."""
    return httpx.AsyncClient(
        base_url=base_url,
        transport=httpx.MockTransport(handler),
        headers={"User-Agent": "ferry-agent-mcp", "Authorization": f"Bearer {_TEST_BEARER}"},
        timeout=30.0,
    )


# ---------------------------------------------------------------------------
# Import + tools list
# ---------------------------------------------------------------------------

def test_import_server() -> None:
    from ferry_mcp import server  # noqa: F401


@pytest.mark.asyncio
async def test_tools_registered() -> None:
    from ferry_mcp.server import mcp

    tools = await mcp.list_tools()
    tool_names = {t.name for t in tools}
    expected = {
        "search_library",
        "add_to_library",
        "list_library",
        "list_devices",
        "list_device_methods",
        "deliver",
        "get_delivery_status",
        "list_gateways",
        "get_gateway_job",
        "list_sources",
        "get_profile",
        "list_opds_tokens",
    }
    assert expected <= tool_names


# ---------------------------------------------------------------------------
# search_library
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_library_sends_correct_request(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[{
                "title": "Dune",
                "author": "Herbert",
                "source": "gutenberg",
                "result_id": "r1",
                "format": "epub",
                "size_bytes": 512000,
                "owned": True,
            }],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.search_library("Dune")

    assert len(captured) == 1
    req = captured[0]
    assert req.url.path == "/api/v1/books/search"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert req.headers.get("user-agent") == "ferry-agent-mcp"
    assert "Dune" in result
    assert "déjà en bibliothèque: oui" in result


@pytest.mark.asyncio
async def test_search_library_forwards_scope(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(200, json=[])

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    await server.search_library("Dune", scope=["legal"])

    body = _json.loads(captured[0].content)
    assert body == {"query": "Dune", "scope": ["legal"]}


# ---------------------------------------------------------------------------
# list_library
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_library_sends_correct_request(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "items": [{
                    "id": "lib-1",
                    "title": "Dune",
                    "author": "Herbert",
                    "original_format": "epub",
                    "cover_url": None,
                    "source_id": None,
                    "added_at": "2026-01-01T00:00:00Z",
                }],
                "total": 1,
                "page": 1,
                "limit": 50,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_library()

    req = captured[0]
    assert req.method == "GET"
    assert req.url.path == "/api/v1/books"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "lib-1" in result
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
            json=[{
                "id": "aaa-111",
                "name": "Salon",
                "brand": "kindle",
                "model": "Paperwhite",
                "delivery_tier": "A",
                "cloud_provider": None,
                "cloud_linked": False,
            }],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_devices()

    req = captured[0]
    assert req.url.path == "/api/v1/devices"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "kindle" in result.lower()
    assert "Salon" in result


# ---------------------------------------------------------------------------
# list_device_methods / list_gateways / get_gateway_job
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_device_methods_sends_correct_path(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[
                {"method": "email", "available": True, "reason_code": None},
                {"method": "dropbox", "available": False, "reason_code": "cloud_not_linked"},
            ],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_device_methods("dev-1")

    assert captured[0].url.path == "/api/v1/devices/dev-1/methods"
    assert "✓ email" in result
    assert "cloud_not_linked" in result


@pytest.mark.asyncio
async def test_list_gateways_sends_correct_request(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[{
                "gateway_id": "gw-1",
                "name": "Maison",
                "status": "paired",
                "last_seen_at": "2026-01-02T10:00:00Z",
            }],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_gateways()

    assert captured[0].url.path == "/api/v1/gateways"
    assert captured[0].headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "Maison" in result
    assert "gateway:gw-1" in result


@pytest.mark.asyncio
async def test_get_gateway_job_sends_correct_path(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []
    job_id = "job-gw-9"

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "job_id": job_id,
                "type": "fetch",
                "status": "done",
                "library_item_id": "lib-42",
                "error": None,
                "attempts": 1,
                "payload": {},
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.get_gateway_job(job_id)

    assert captured[0].url.path == f"/api/v1/gateways/jobs/{job_id}"
    assert "lib-42" in result
    assert "done" in result


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
            json={
                "id": "lib-123",
                "title": "Dune",
                "author": "Herbert",
                "cover_url": None,
                "source_id": None,
                "original_format": "epub",
                "added_at": "2026-01-01T00:00:00Z",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.add_to_library("gutenberg", "r1")

    req = captured[0]
    assert req.url.path == "/api/v1/books"
    body = _json.loads(req.content)
    assert body["source"] == "gutenberg"
    assert body["result_id"] == "r1"
    assert "lib-123" in result


@pytest.mark.asyncio
async def test_add_to_library_gateway_async_hints_followup(monkeypatch) -> None:
    from ferry_mcp import server

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            201,
            json={"gateway_job_id": "gw-job-1", "status": "pending"},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.add_to_library("gateway:aaa", "magnet:xyz")

    assert "gw-job-1" in result
    assert "get_gateway_job" in result


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
            json={
                "id": job_id,
                "status": "delivered",
                "method": "email",
                "item_title": "Dune",
                "device_label": "kindle Paperwhite",
                "delivered_at": "2026-01-02T10:00:00Z",
                "error": None,
                "download_url": None,
                "target_format": "mobi",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.get_delivery_status(job_id)

    req = captured[0]
    assert req.url.path == f"/api/v1/deliveries/{job_id}"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "delivered" in result
    assert "Dune" in result
    assert "mobi" in result


# ---------------------------------------------------------------------------
# deliver — garde-fou sans confirm
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deliver_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.url.path.endswith("/methods"):
            return httpx.Response(
                200,
                json=[{"method": "email", "available": True, "reason_code": None}],
            )
        if req.url.path == "/api/v1/devices":
            return httpx.Response(
                200,
                json=[{
                    "id": "device-1",
                    "name": "Salon",
                    "brand": "kindle",
                    "model": "PW",
                    "delivery_tier": "A",
                    "cloud_linked": False,
                }],
            )
        return httpx.Response(200, json=[])

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver("item-1", "device-1", confirm=False)

    # Aucun appel POST /deliveries ne doit avoir été émis
    post_calls = [c for c in calls if c.method == "POST"]
    assert len(post_calls) == 0, "deliver sans confirm ne doit pas appeler POST /deliveries"
    assert "confirm=True" in result
    assert "⚠️" in result
    assert "email" in result


# ---------------------------------------------------------------------------
# deliver — avec confirm=True + method
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deliver_with_confirm_calls_core_with_method(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        if req.url.path.endswith("/methods"):
            return httpx.Response(
                200,
                json=[
                    {"method": "dropbox", "available": True, "reason_code": None},
                    {"method": "email", "available": False, "reason_code": "smtp_not_configured"},
                ],
            )
        if req.url.path == "/api/v1/devices":
            return httpx.Response(200, json=[])
        return httpx.Response(
            201,
            json={
                "id": "job-42",
                "status": "queued",
                "library_item_id": "item-1",
                "device_id": "device-1",
                "method": "dropbox",
                "created_at": "2026-01-01T00:00:00Z",
                "delivered_at": None,
                "error": None,
                "download_url": None,
                "item_title": "Dune",
                "device_label": "Kobo Clara",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver(
        "item-1", "device-1", confirm=True, method="dropbox", format="epub"
    )

    post_calls = [c for c in captured if c.method == "POST"]
    assert len(post_calls) == 1
    req = post_calls[0]
    assert req.url.path == "/api/v1/deliveries"
    assert req.headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    body = _json.loads(req.content)
    assert body["library_item_id"] == "item-1"
    assert body["device_id"] == "device-1"
    assert body["method"] == "dropbox"
    assert body["format"] == "epub"
    assert "job-42" in result


@pytest.mark.asyncio
async def test_deliver_auto_picks_first_available_method(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        if req.url.path.endswith("/methods"):
            return httpx.Response(
                200,
                json=[
                    {"method": "email", "available": False, "reason_code": "smtp_not_configured"},
                    {"method": "browser_code", "available": True, "reason_code": None},
                ],
            )
        if req.url.path == "/api/v1/devices":
            return httpx.Response(200, json=[])
        return httpx.Response(
            201,
            json={
                "id": "job-77",
                "status": "ready",
                "method": "browser_code",
                "download_url": "https://example.test/c/abc",
                "library_item_id": "item-1",
                "device_id": "device-1",
                "created_at": "2026-01-01T00:00:00Z",
                "delivered_at": None,
                "error": None,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver("item-1", "device-1", confirm=True)

    body = _json.loads([c for c in captured if c.method == "POST"][0].content)
    assert body["method"] == "browser_code"
    assert "https://example.test/c/abc" in result


# ---------------------------------------------------------------------------
# Erreurs core actionnables
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_core_401_raises_actionable_auth_error(monkeypatch) -> None:
    from ferry_mcp import server

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Authorization Bearer requis"})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    with pytest.raises(RuntimeError, match="Authentification requise"):
        await server.list_library()


@pytest.mark.asyncio
async def test_core_404_raises_actionable_not_found(monkeypatch) -> None:
    from ferry_mcp import server

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "delivery job introuvable"})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    with pytest.raises(RuntimeError, match="introuvable"):
        await server.get_delivery_status("missing-job")


@pytest.mark.asyncio
async def test_core_400_includes_stable_detail(monkeypatch) -> None:
    from ferry_mcp import server

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/methods"):
            return httpx.Response(
                200,
                json=[{"method": "email", "available": True, "reason_code": None}],
            )
        if req.url.path == "/api/v1/devices":
            return httpx.Response(200, json=[])
        return httpx.Response(
            400,
            json={"detail": "method 'usb' indisponible pour ce device (tier A)"},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    with pytest.raises(RuntimeError, match="Requête invalide"):
        await server.deliver("item-1", "device-1", confirm=True, method="email")


@pytest.mark.asyncio
async def test_list_sources_and_profile(monkeypatch) -> None:
    from ferry_mcp import server

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/api/v1/sources":
            return httpx.Response(
                200,
                json=[
                    {"id": "s1", "type": "gutenberg", "enabled": True, "created_at": "2026-01-01T00:00:00Z"},
                    {"id": "s2", "type": "standard_ebooks", "enabled": False, "created_at": "2026-01-01T00:00:00Z"},
                ],
            )
        if req.url.path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "email": "reader@example.test",
                    "kindle_email": None,
                    "default_format": "epub",
                },
            )
        if req.url.path == "/api/v1/opds/tokens":
            return httpx.Response(
                200,
                json=[{
                    "id": "tok-1",
                    "label": "Kobo",
                    "created_at": "2026-01-01T00:00:00Z",
                    "last_used_at": None,
                }],
            )
        return httpx.Response(404, json={"detail": "unexpected"})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    sources = await server.list_sources()
    assert "gutenberg" in sources and "désactivée" in sources

    profile = await server.get_profile()
    assert "reader@example.test" in profile
    assert "epub" in profile

    tokens = await server.list_opds_tokens()
    assert "Kobo" in tokens
    assert "token_id: tok-1" in tokens
    # Jamais de secret jeton dans la sortie (OpdsTokenOut n'expose que l'id)
    assert "raw" not in tokens.lower()
    assert "secret" not in tokens.lower()
