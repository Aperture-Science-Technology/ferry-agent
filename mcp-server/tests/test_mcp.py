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
        "get_mail_settings",
        "list_opds_tokens",
        "update_profile",
        "get_device",
        "add_device",
        "update_device",
        "remove_device",
        "link_device_cloud",
        "set_source_enabled",
        "list_deliveries",
        "plan_delivery",
        "diagnose",
        "deliver_to_kindle",
        "search_library_items",
        "update_library_item",
        "delete_library_item",
        "list_library_item_deliveries",
        "download_library_item",
        "create_gateway",
        "recreate_gateway",
        "revoke_gateway",
        "delete_gateway",
        "list_gateway_jobs",
        "create_opds_token",
        "revoke_opds_token",
    }
    assert expected <= tool_names


@pytest.mark.asyncio
async def test_protocol_version_and_inmemory_client_lists_tools() -> None:
    """Lot 0 : FastMCP Client en mémoire + protocole ≠ 2025-11-25."""
    from mcp.types import LATEST_PROTOCOL_VERSION
    from fastmcp import Client
    from ferry_mcp.server import mcp

    assert LATEST_PROTOCOL_VERSION != "2025-11-25"
    assert LATEST_PROTOCOL_VERSION == "2026-07-28"

    async with Client(mcp) as client:
        tools = await client.list_tools()
        names = {t.name for t in tools}
        assert "search_library" in names
        assert "update_profile" in names
        assert "link_device_cloud" in names
        assert len(names) >= 20
        assert client.protocol_version == "2026-07-28"
        discover = client.session.discover_result
        assert discover is not None
        assert "2026-07-28" in (discover.supported_versions or [])


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

    result = (await server.search_library("Dune")).content[0].text

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
async def test_list_device_methods_translates_kindle_email_missing(monkeypatch) -> None:
    from ferry_mcp import server

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "method": "email",
                    "available": False,
                    "reason_code": "kindle_email_missing",
                },
            ],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_device_methods("dev-1")

    assert "kindle_email_missing" in result
    assert "aucune adresse Send-to-Kindle connue" in result
    assert "✗ email" in result


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

    result = await server.add_to_library(
        "gutenberg", "r1",
        result={"source": "gutenberg", "result_id": "r1", "title": "Dune", "author": "Herbert"},
    )

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

    result = await server.add_to_library(
        "gateway:aaa", "magnet:xyz",
        result={"source": "gateway:aaa", "result_id": "magnet:xyz", "title": "Dune"},
    )

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


@pytest.mark.asyncio
async def test_get_delivery_status_email_sent_explains_not_delivered(monkeypatch) -> None:
    from ferry_mcp import server

    job_id = "job-email-sent"

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": job_id,
                "status": "sent",
                "method": "email",
                "item_title": "Dune",
                "device_label": "kindle Paperwhite",
                "delivered_at": None,
                "error": None,
                "download_url": None,
                "target_format": "epub",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.get_delivery_status(job_id)

    assert "status: sent" in result
    assert "method: email" in result
    assert "ne prouve pas la remise" in result
    assert "get_mail_settings" in result
    assert "status: delivered" not in result
    assert "livré" not in result.lower()


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


@pytest.mark.asyncio
async def test_get_mail_settings_shows_sender_and_warning(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "configured": True,
                "sender_address": "send@ferry-agent.aperture-agency.org",
                "reply_to": None,
                "allowed_domains": ["kindle.com", "kindle.fr"],
                "hourly_quota": 30,
                "daily_quota": 80,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.get_mail_settings()

    assert captured[0].url.path == "/api/v1/mail/settings"
    assert captured[0].headers.get("authorization") == f"Bearer {_TEST_BEARER}"
    assert "send@ferry-agent.aperture-agency.org" in result
    assert "Approved Personal Document Email List" in result
    assert "amazon.com/mycd" in result
    assert "aucun rebond" in result
    assert "abandonné en silence" in result
    assert "kindle.com" in result
    assert "quota horaire: 30" in result
    assert "quota quotidien: 80" in result
    assert "envoi configuré: oui" in result
    # Pas de secrets SMTP
    assert "password" not in result.lower()
    assert "smtp_host" not in result.lower()


# ---------------------------------------------------------------------------
# update_profile
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_profile_sends_partial_patch(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "id": "u1",
                "email": "reader@example.test",
                "kindle_email": "me@kindle.com",
                "default_format": "pdf",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.update_profile(
        kindle_email="me@kindle.com", default_format="pdf"
    )

    assert captured[0].method == "PATCH"
    assert captured[0].url.path == "/api/v1/users/me"
    body = _json.loads(captured[0].content)
    assert body == {"kindle_email": "me@kindle.com", "default_format": "pdf"}
    assert "me@kindle.com" in result
    assert "pdf" in result


@pytest.mark.asyncio
async def test_update_profile_clear_kindle_email_sends_null(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "id": "u1",
                "email": "reader@example.test",
                "kindle_email": None,
                "default_format": "epub",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.update_profile(clear_kindle_email=True)

    body = _json.loads(captured[0].content)
    assert body == {"kindle_email": None}
    assert "non défini" in result


@pytest.mark.asyncio
async def test_update_profile_rejects_invalid_format(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(200, json={})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    with pytest.raises(RuntimeError, match="default_format"):
        await server.update_profile(default_format="docx")
    assert calls == []


# ---------------------------------------------------------------------------
# get_device / add_device / update_device / remove_device / link / source
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_device_sends_correct_path(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "id": "dev-9",
                "name": "Salon",
                "brand": "kindle",
                "model": "Paperwhite",
                "delivery_tier": "A",
                "cloud_provider": None,
                "cloud_linked": False,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.get_device("dev-9")

    assert captured[0].method == "GET"
    assert captured[0].url.path == "/api/v1/devices/dev-9"
    assert "Salon" in result
    assert "dev-9" in result


@pytest.mark.asyncio
async def test_add_device_sends_payload_without_tier(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            201,
            json={
                "id": "new-dev",
                "name": "Voyage",
                "brand": "kindle",
                "model": "Oasis",
                "delivery_tier": "A",
                "cloud_linked": False,
                "cloud_provider": None,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.add_device(
        brand="kindle",
        name="Voyage",
        model="Oasis",
        email_address="voyage@kindle.com",
    )

    req = captured[0]
    assert req.method == "POST"
    assert req.url.path == "/api/v1/devices"
    body = _json.loads(req.content)
    assert body["brand"] == "kindle"
    assert body["email_address"] == "voyage@kindle.com"
    assert "delivery_tier" not in body
    assert "new-dev" in result
    assert "Voyage" in result


@pytest.mark.asyncio
async def test_add_device_rejects_invalid_brand(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(200, json={})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    with pytest.raises(RuntimeError, match="brand"):
        await server.add_device(brand="sony")
    assert calls == []


@pytest.mark.asyncio
async def test_update_device_sends_only_provided_fields(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "id": "dev-1",
                "name": "Bureau",
                "brand": "kobo",
                "model": "Clara",
                "delivery_tier": "C",
                "cloud_linked": False,
                "cloud_provider": None,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.update_device("dev-1", name="Bureau", conversion_profile="reader_6in")

    assert captured[0].method == "PATCH"
    assert captured[0].url.path == "/api/v1/devices/dev-1"
    body = _json.loads(captured[0].content)
    assert body == {"name": "Bureau", "conversion_profile": "reader_6in"}
    assert "Bureau" in result


@pytest.mark.asyncio
async def test_remove_device_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(
            200,
            json={
                "id": "dev-del",
                "name": "Salon",
                "brand": "kindle",
                "model": "PW",
                "delivery_tier": "A",
                "cloud_linked": False,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.remove_device("dev-del", confirm=False)

    assert all(c.method == "GET" for c in calls)
    assert "confirm=True" in result
    assert "Salon" in result


@pytest.mark.asyncio
async def test_remove_device_with_confirm_deletes(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.method == "GET":
            return httpx.Response(
                200,
                json={
                    "id": "dev-del",
                    "name": "Salon",
                    "brand": "kindle",
                    "model": "PW",
                    "delivery_tier": "A",
                    "cloud_linked": False,
                },
            )
        return httpx.Response(204)

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.remove_device("dev-del", confirm=True)

    assert any(c.method == "DELETE" and c.url.path == "/api/v1/devices/dev-del" for c in calls)
    assert "supprimée" in result.lower()
    assert "Salon" in result


@pytest.mark.asyncio
async def test_link_device_cloud_returns_browser_url(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={"url": "https://www.dropbox.com/oauth2/authorize?state=abc"},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.link_device_cloud("dev-b", "dropbox")

    req = captured[0]
    assert req.method == "GET"
    assert req.url.path == "/api/v1/devices/dev-b/link"
    assert req.url.params.get("provider") == "dropbox"
    assert "https://www.dropbox.com/oauth2/authorize" in result
    assert "navigateur" in result.lower()
    assert "cloud_link=ok" in result
    assert "tier B" in result


@pytest.mark.asyncio
async def test_set_source_enabled_sends_patch(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "id": "src-1",
                "type": "gutenberg",
                "enabled": False,
                "created_at": "2026-01-01T00:00:00Z",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.set_source_enabled("src-1", enabled=False)

    req = captured[0]
    assert req.method == "PATCH"
    assert req.url.path == "/api/v1/sources/src-1"
    assert _json.loads(req.content) == {"enabled": False}
    assert "gutenberg" in result
    assert "désactivée" in result


# ---------------------------------------------------------------------------
# list_deliveries
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_deliveries_sorts_and_limits(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[
                {
                    "id": "old",
                    "status": "failed",
                    "method": "email",
                    "created_at": "2026-01-01T10:00:00Z",
                    "item_title": "Ancien",
                    "device_label": "Kindle A",
                    "error": "smtp timeout",
                },
                {
                    "id": "new",
                    "status": "sent",
                    "method": "email",
                    "created_at": "2026-01-02T10:00:00Z",
                    "item_title": "Récent",
                    "device_label": "Kindle B",
                    "error": None,
                },
                {
                    "id": "mid",
                    "status": "delivered",
                    "method": "dropbox",
                    "created_at": "2026-01-01T18:00:00Z",
                    "item_title": "Milieu",
                    "device_label": "Kobo",
                    "error": None,
                },
            ],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_deliveries(limit=2)

    assert captured[0].method == "GET"
    assert captured[0].url.path == "/api/v1/deliveries"
    assert "Récent" in result
    assert "Milieu" in result
    assert "Ancien" not in result  # hors limit après tri décroissant
    assert "sent" in result
    assert "get_mail_settings" in result
    assert "pas remis" in result.lower() or "pas remis" in result


# ---------------------------------------------------------------------------
# plan_delivery
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_plan_delivery_resolves_format_and_methods(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        path = req.url.path
        if path == "/api/v1/deliveries/preview":
            return httpx.Response(200, json={"target_format": "epub"})
        if path == "/api/v1/books/item-1":
            return httpx.Response(
                200,
                json={
                    "id": "item-1",
                    "title": "Dune",
                    "original_format": "epub",
                },
            )
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "email": "u@example.com",
                    "kindle_email": "me@kindle.com",
                    "default_format": "azw3",
                },
            )
        if path == "/api/v1/devices":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "dev-k",
                        "name": "Salon",
                        "brand": "kindle",
                        "model": "Paperwhite",
                        "delivery_tier": "A",
                        "email_address": None,
                        "cloud_linked": False,
                    }
                ],
            )
        if path == "/api/v1/devices/dev-k/methods":
            return httpx.Response(
                200,
                json=[
                    {"method": "email", "available": True},
                    {
                        "method": "dropbox",
                        "available": False,
                        "reason_code": "cloud_not_linked",
                    },
                ],
            )
        return httpx.Response(404, json={"detail": "unexpected"})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.plan_delivery("item-1")

    paths = [c.url.path for c in captured]
    assert "/api/v1/books/item-1" in paths
    assert "/api/v1/users/me" in paths
    assert "/api/v1/devices" in paths
    assert "/api/v1/devices/dev-k/methods" in paths
    assert "Dune" in result
    assert "Format cible résolu: `epub`" in result
    assert "default_format" in result
    assert "✓ email" in result
    assert "✗ dropbox" in result
    assert "me@kindle.com" in result
    assert "deliver_to_kindle" in result


# ---------------------------------------------------------------------------
# diagnose
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_diagnose_aggregates_profile_mail_devices_failed(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        path = req.url.path
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "email": "u@example.com",
                    "kindle_email": None,
                    "default_format": "epub",
                },
            )
        if path == "/api/v1/mail/settings":
            return httpx.Response(
                200,
                json={
                    "configured": True,
                    "sender_address": "ferry@example.com",
                    "allowed_domains": ["kindle.com"],
                    "hourly_quota": 10,
                    "daily_quota": 50,
                },
            )
        if path == "/api/v1/devices":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "dev-k",
                        "name": "Salon",
                        "brand": "kindle",
                        "model": "PW",
                        "delivery_tier": "A",
                        "cloud_linked": False,
                    }
                ],
            )
        if path == "/api/v1/devices/dev-k/methods":
            return httpx.Response(
                200,
                json=[
                    {
                        "method": "email",
                        "available": False,
                        "reason_code": "kindle_email_missing",
                    }
                ],
            )
        if path == "/api/v1/deliveries":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "j-fail",
                        "status": "failed",
                        "method": "email",
                        "created_at": "2026-01-02T00:00:00Z",
                        "item_title": "Dune",
                        "device_label": "Salon",
                        "error": "relais refusé",
                    },
                    {
                        "id": "j-ok",
                        "status": "sent",
                        "method": "email",
                        "created_at": "2026-01-03T00:00:00Z",
                        "item_title": "Autre",
                        "device_label": "Salon",
                        "error": None,
                    },
                ],
            )
        return httpx.Response(404, json={"detail": "unexpected"})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.diagnose()

    paths = [c.url.path for c in captured]
    assert "/api/v1/users/me" in paths
    assert "/api/v1/mail/settings" in paths
    assert "/api/v1/devices" in paths
    assert "/api/v1/deliveries" in paths
    assert "kindle_email" in result.lower() or "non défini" in result
    assert "update_profile" in result
    assert "ferry@example.com" in result
    assert "kindle_email_missing" in result
    assert "update_device" in result
    assert "relais refusé" in result
    assert "j-fail" in result


# ---------------------------------------------------------------------------
# deliver_to_kindle
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deliver_to_kindle_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    post_calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            post_calls.append(req)
        path = req.url.path
        if path == "/api/v1/deliveries/preview":
            return httpx.Response(200, json={"target_format": "epub"})
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "email": "u@example.com",
                    "kindle_email": "me@kindle.com",
                    "default_format": "epub",
                },
            )
        if path == "/api/v1/devices":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "dev-k",
                        "name": "Salon",
                        "brand": "kindle",
                        "model": "PW",
                        "delivery_tier": "A",
                        "email_address": "dev@kindle.com",
                        "cloud_linked": False,
                    }
                ],
            )
        if path == "/api/v1/devices/dev-k/methods":
            return httpx.Response(
                200,
                json=[{"method": "email", "available": True}],
            )
        if path == "/api/v1/books/item-1":
            return httpx.Response(
                200,
                json={"id": "item-1", "title": "Dune", "original_format": "epub"},
            )
        return httpx.Response(404, json={"detail": path})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver_to_kindle("item-1", confirm=False)

    assert len(post_calls) == 0
    assert "non confirmé" in result.lower() or "dry-run" in result.lower()
    assert "email" in result
    assert "dev@kindle.com" in result
    assert "confirm=True" in result


@pytest.mark.asyncio
async def test_deliver_to_kindle_rejects_non_kindle_device(monkeypatch) -> None:
    from ferry_mcp import server

    post_calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST" and req.url.path == "/api/v1/deliveries":
            post_calls.append(req)
        path = req.url.path
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "kindle_email": "me@kindle.com",
                    "default_format": "epub",
                    "email": "u@example.com",
                },
            )
        if path == "/api/v1/devices/dev-kobo":
            return httpx.Response(
                200,
                json={
                    "id": "dev-kobo",
                    "name": "Forma",
                    "brand": "kobo",
                    "model": "Forma",
                    "delivery_tier": "B",
                    "cloud_linked": True,
                },
            )
        return httpx.Response(404, json={"detail": path})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver_to_kindle(
        "item-1", device_id="dev-kobo", confirm=True
    )

    assert len(post_calls) == 0
    assert "n'est pas un Kindle" in result
    assert "deliver" in result


@pytest.mark.asyncio
async def test_deliver_to_kindle_no_kindle_does_not_post(monkeypatch) -> None:
    from ferry_mcp import server

    post_calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            post_calls.append(req)
        path = req.url.path
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "kindle_email": None,
                    "default_format": "epub",
                    "email": "u@example.com",
                },
            )
        if path == "/api/v1/devices":
            return httpx.Response(200, json=[])
        return httpx.Response(404, json={"detail": path})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver_to_kindle("item-1", confirm=True)

    assert len(post_calls) == 0
    assert "add_device" in result
    assert "brand='kindle'" in result


@pytest.mark.asyncio
async def test_deliver_to_kindle_multiple_kindles_asks_device_id(monkeypatch) -> None:
    from ferry_mcp import server

    post_calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            post_calls.append(req)
        path = req.url.path
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "kindle_email": "me@kindle.com",
                    "default_format": "epub",
                    "email": "u@example.com",
                },
            )
        if path == "/api/v1/devices":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "k1",
                        "name": "Salon",
                        "brand": "kindle",
                        "model": "PW",
                        "delivery_tier": "A",
                        "cloud_linked": False,
                    },
                    {
                        "id": "k2",
                        "name": "Voyage",
                        "brand": "kindle",
                        "model": "Oasis",
                        "delivery_tier": "A",
                        "cloud_linked": False,
                    },
                ],
            )
        return httpx.Response(404, json={"detail": path})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver_to_kindle("item-1", confirm=True)

    assert len(post_calls) == 0
    assert "Plusieurs Kindle" in result
    assert "k1" in result and "k2" in result
    assert "device_id" in result


@pytest.mark.asyncio
async def test_deliver_to_kindle_email_unavailable_explains_fix(monkeypatch) -> None:
    from ferry_mcp import server

    post_calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST" and req.url.path == "/api/v1/deliveries":
            post_calls.append(req)
        path = req.url.path
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "kindle_email": None,
                    "default_format": "epub",
                    "email": "u@example.com",
                },
            )
        if path == "/api/v1/devices/dev-k":
            return httpx.Response(
                200,
                json={
                    "id": "dev-k",
                    "name": "Salon",
                    "brand": "kindle",
                    "model": "PW",
                    "delivery_tier": "A",
                    "email_address": None,
                    "cloud_linked": False,
                },
            )
        if path == "/api/v1/devices/dev-k/methods":
            return httpx.Response(
                200,
                json=[
                    {
                        "method": "email",
                        "available": False,
                        "reason_code": "kindle_email_missing",
                    }
                ],
            )
        return httpx.Response(404, json={"detail": path})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver_to_kindle(
        "item-1", device_id="dev-k", confirm=True
    )

    assert len(post_calls) == 0
    assert "kindle_email_missing" in result
    assert "update_profile" in result or "update_device" in result
    assert "POST /deliveries" in result or "n'a été envoyé" in result


@pytest.mark.asyncio
async def test_deliver_to_kindle_confirm_posts_email_delivery(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        path = req.url.path
        if path == "/api/v1/deliveries/preview":
            return httpx.Response(200, json={"target_format": "epub"})
        if req.method == "PATCH" and path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "email": "u@example.com",
                    "kindle_email": "new@kindle.com",
                    "default_format": "epub",
                },
            )
        if path == "/api/v1/users/me":
            return httpx.Response(
                200,
                json={
                    "id": "u1",
                    "email": "u@example.com",
                    "kindle_email": "new@kindle.com",
                    "default_format": "epub",
                },
            )
        if path == "/api/v1/devices":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "dev-k",
                        "name": "Salon",
                        "brand": "kindle",
                        "model": "PW",
                        "delivery_tier": "A",
                        "email_address": None,
                        "cloud_linked": False,
                    }
                ],
            )
        if path == "/api/v1/devices/dev-k/methods":
            return httpx.Response(
                200,
                json=[{"method": "email", "available": True}],
            )
        if path == "/api/v1/books/item-1":
            return httpx.Response(
                200,
                json={"id": "item-1", "title": "Dune", "original_format": "epub"},
            )
        if req.method == "POST" and path == "/api/v1/deliveries":
            return httpx.Response(
                201,
                json={
                    "id": "job-1",
                    "status": "sent",
                    "method": "email",
                    "item_title": "Dune",
                    "device_label": "Salon (kindle PW)",
                    "target_format": "epub",
                    "delivered_at": None,
                    "error": None,
                },
            )
        return httpx.Response(404, json={"detail": path})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.deliver_to_kindle(
        "item-1",
        kindle_email="new@kindle.com",
        format="epub",
        confirm=True,
    )

    patch_reqs = [c for c in captured if c.method == "PATCH"]
    assert patch_reqs
    assert _json.loads(patch_reqs[0].content) == {"kindle_email": "new@kindle.com"}

    post_reqs = [
        c for c in captured
        if c.method == "POST" and c.url.path == "/api/v1/deliveries"
    ]
    assert len(post_reqs) == 1
    body = _json.loads(post_reqs[0].content)
    assert body == {
        "library_item_id": "item-1",
        "device_id": "dev-k",
        "method": "email",
        "format": "epub",
    }
    assert "job-1" in result
    assert "sent" in result
    assert "get_delivery_status" in result
    assert "get_mail_settings" in result
    assert "new@kindle.com" in result


# ---------------------------------------------------------------------------
# Lot 3A — bibliothèque écriture / téléchargement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_library_items_sends_q_param(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "items": [{
                    "id": "lib-q",
                    "title": "Dune",
                    "author": "Herbert",
                    "original_format": "epub",
                }],
                "total": 1,
                "page": 1,
                "limit": 20,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.search_library_items("dune", page=1, limit=20)

    req = captured[0]
    assert req.method == "GET"
    assert req.url.path == "/api/v1/books"
    assert req.url.params.get("q") == "dune"
    assert "lib-q" in result
    assert "Dune" in result


@pytest.mark.asyncio
async def test_update_library_item_sends_only_provided_fields(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "id": "lib-1",
                "title": "Dune Messiah",
                "author": "Herbert",
                "language": "fr",
                "isbn": None,
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.update_library_item("lib-1", title="Dune Messiah", language="fr")

    assert captured[0].method == "PATCH"
    assert captured[0].url.path == "/api/v1/books/lib-1"
    body = _json.loads(captured[0].content)
    assert body == {"title": "Dune Messiah", "language": "fr"}
    assert "Dune Messiah" in result


@pytest.mark.asyncio
async def test_update_library_item_refuses_empty_body(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(200, json={})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    with pytest.raises(RuntimeError, match="au moins un champ"):
        await server.update_library_item("lib-1")
    assert calls == []


@pytest.mark.asyncio
async def test_delete_library_item_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(
            200,
            json={"id": "lib-del", "title": "Dune", "author": "Herbert"},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.delete_library_item("lib-del", confirm=False)

    assert all(c.method == "GET" for c in calls)
    assert "confirm=True" in result
    assert "Dune" in result


@pytest.mark.asyncio
async def test_delete_library_item_with_confirm_deletes(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.method == "GET":
            return httpx.Response(
                200,
                json={"id": "lib-del", "title": "Dune", "author": "Herbert"},
            )
        return httpx.Response(204)

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.delete_library_item("lib-del", confirm=True)

    assert any(c.method == "DELETE" and c.url.path == "/api/v1/books/lib-del" for c in calls)
    assert "supprimé" in result.lower()


@pytest.mark.asyncio
async def test_list_library_item_deliveries_path(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[{
                "id": "job-1",
                "status": "sent",
                "method": "email",
                "created_at": "2026-01-02T00:00:00Z",
                "item_title": "Dune",
                "device_label": "Salon",
                "error": None,
            }],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_library_item_deliveries("lib-1")

    assert captured[0].method == "GET"
    assert captured[0].url.path == "/api/v1/books/lib-1/deliveries"
    assert "Dune" in result
    assert "job-1" in result


@pytest.mark.asyncio
async def test_download_library_item_posts_download_link(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "url": "https://ferry.example.test/api/v1/downloads/tok",
                "expires_at": "2026-01-01T00:15:00Z",
                "format": "epub",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.download_library_item("lib-1", format="epub")

    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/books/lib-1/download-link"
    assert _json.loads(captured[0].content) == {"format": "epub"}
    assert "15 minutes" in result
    assert "tok" in result
    assert "epub" in result


# ---------------------------------------------------------------------------
# Lot 3B — gateways / OPDS
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_gateway_posts_and_warns_secrets(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            201,
            json={
                "gateway_id": "gw-1",
                "pairing_token": "pair-secret",
                "gateway_key": "key-secret",
                "pairing_expires_at": "2026-01-01T00:15:00Z",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.create_gateway(name="Salon")

    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/gateways"
    assert _json.loads(captured[0].content) == {"name": "Salon"}
    assert "pair-secret" in result
    assert "une seule fois" in result.lower()
    assert "Installez" in result


@pytest.mark.asyncio
async def test_recreate_gateway_posts(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json={
                "gateway_id": "gw-1",
                "pairing_token": "new-pair",
                "gateway_key": "new-key",
                "pairing_expires_at": "2026-01-01T00:15:00Z",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.recreate_gateway("gw-1")

    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/gateways/gw-1/recreate"
    assert "new-pair" in result
    assert "une seule fois" in result.lower()


@pytest.mark.asyncio
async def test_revoke_gateway_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(
            200,
            json=[{"gateway_id": "gw-1", "name": "Maison", "status": "paired"}],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.revoke_gateway("gw-1", confirm=False)

    assert all(c.method == "GET" for c in calls)
    assert "confirm=True" in result
    assert "Maison" in result


@pytest.mark.asyncio
async def test_revoke_gateway_with_confirm_posts(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.method == "GET":
            return httpx.Response(
                200,
                json=[{"gateway_id": "gw-1", "name": "Maison", "status": "paired"}],
            )
        return httpx.Response(200, json={"gateway_id": "gw-1"})

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.revoke_gateway("gw-1", confirm=True)

    post = [c for c in calls if c.method == "POST"]
    assert len(post) == 1
    assert post[0].url.path == "/api/v1/gateways/revoke"
    assert _json.loads(post[0].content) == {"gateway_id": "gw-1"}
    assert "révoquée" in result.lower()


@pytest.mark.asyncio
async def test_delete_gateway_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(
            200,
            json=[{"gateway_id": "gw-1", "name": "Maison", "status": "paired"}],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.delete_gateway("gw-1", confirm=False)

    assert all(c.method == "GET" for c in calls)
    assert "confirm=True" in result
    assert not any(c.method == "DELETE" for c in calls)


@pytest.mark.asyncio
async def test_delete_gateway_with_confirm_deletes(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.method == "GET":
            return httpx.Response(
                200,
                json=[{"gateway_id": "gw-1", "name": "Maison", "status": "paired"}],
            )
        return httpx.Response(204)

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.delete_gateway("gw-1", confirm=True)

    assert any(c.method == "DELETE" and c.url.path == "/api/v1/gateways/gw-1" for c in calls)
    assert "supprimée" in result.lower()


@pytest.mark.asyncio
async def test_list_gateway_jobs_path(monkeypatch) -> None:
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            200,
            json=[{
                "job_id": "job-g1",
                "type": "fetch",
                "status": "done",
                "library_item_id": "lib-1",
                "attempts": 1,
            }],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.list_gateway_jobs("gw-1", limit=10)

    assert captured[0].method == "GET"
    assert captured[0].url.path == "/api/v1/gateways/gw-1/jobs"
    assert captured[0].url.params.get("limit") == "10"
    assert "job-g1" in result
    assert "lib-1" in result


@pytest.mark.asyncio
async def test_create_opds_token_posts(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(
            201,
            json={
                "id": "tok-1",
                "label": "Clara",
                "token": "secret-opds",
                "url": "https://ferry.example.test/opds/secret-opds",
                "created_at": "2026-01-01T00:00:00Z",
            },
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.create_opds_token(label="Clara")

    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/opds/tokens"
    assert _json.loads(captured[0].content) == {"label": "Clara"}
    assert "secret-opds" in result
    assert "une seule fois" in result.lower()
    assert "OPDS" in result


@pytest.mark.asyncio
async def test_revoke_opds_token_refuses_without_confirm(monkeypatch) -> None:
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(
            200,
            json=[{"id": "tok-1", "label": "Clara", "created_at": "2026-01-01T00:00:00Z"}],
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.revoke_opds_token("tok-1", confirm=False)

    assert all(c.method == "GET" for c in calls)
    assert "confirm=True" in result
    assert not any(c.method == "POST" for c in calls)


@pytest.mark.asyncio
async def test_revoke_opds_token_with_confirm_posts(monkeypatch) -> None:
    import json as _json
    from ferry_mcp import server

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.method == "GET":
            return httpx.Response(
                200,
                json=[{"id": "tok-1", "label": "Clara", "created_at": "2026-01-01T00:00:00Z"}],
            )
        return httpx.Response(
            200,
            json={"id": "tok-1", "label": "Clara", "created_at": "2026-01-01T00:00:00Z", "last_used_at": None},
        )

    monkeypatch.setattr(server, "_client", lambda token=None: _mock_client(handler))

    result = await server.revoke_opds_token("tok-1", confirm=True)

    post = [c for c in calls if c.method == "POST"]
    assert len(post) == 1
    assert post[0].url.path == "/api/v1/opds/tokens/revoke"
    assert _json.loads(post[0].content) == {"token_id": "tok-1"}
    assert "révoqué" in result.lower()
