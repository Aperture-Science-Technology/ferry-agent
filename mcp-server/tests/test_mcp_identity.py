"""Tests de la propagation d'identité utilisateur MCP → core.

Vérifie que, lorsqu'un utilisateur Clerk authentifié (OAuth) appelle un
tool MCP, le core reçoit `Authorization: Bearer <token Clerk>` — et non
plus le `X-API-Key` du compte service `mcp-service` — de sorte que
l'action (recherche/ajout/livraison) soit rattachée au bon compte.

Le token exposé par `fastmcp.server.dependencies.get_access_token()` est
celui du `AccessToken` résolu par `ClerkProvider` (un `OAuthProxy`) pour
la session OAuth courante ; il est disponible sans avoir à injecter
`ctx: Context` dans le tool.
"""

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
import pytest

import ferry_mcp.config as _cfg_module
from ferry_mcp.config import MCPSettings


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    settings = MCPSettings(
        ferry_core_url="http://test-core:8000",
        mcp_api_key="test-key-abc",
        port=8001,
    )
    _cfg_module.get_settings.cache_clear()
    monkeypatch.setattr(_cfg_module, "get_settings", lambda: settings)
    # `server.py` importe `get_settings` par valeur (`from ... import get_settings`) :
    # patcher uniquement l'attribut du module config ne suffit pas, il faut
    # aussi patcher la référence déjà liée dans le module server.
    from ferry_mcp import server

    monkeypatch.setattr(server, "get_settings", lambda: settings)
    yield
    monkeypatch.undo()
    _cfg_module.get_settings.cache_clear()


def _enable_auth(monkeypatch) -> MCPSettings:
    """Bascule la config en mode OAuth (mcp_auth_enabled=True).

    Le fixture `patch_settings` (autouse) a déjà remplacé `get_settings` par
    un lambda sans cache : pas de `cache_clear()` à refaire ici.
    """
    settings = MCPSettings(
        ferry_core_url="http://test-core:8000",
        mcp_api_key="test-key-abc",
        port=8001,
        mcp_auth_enabled=True,
    )
    monkeypatch.setattr(_cfg_module, "get_settings", lambda: settings)
    from ferry_mcp import server

    monkeypatch.setattr(server, "get_settings", lambda: settings)
    return settings


# ---------------------------------------------------------------------------
# _resolve_user_token — unité
# ---------------------------------------------------------------------------

def test_resolve_user_token_returns_none_when_auth_disabled(monkeypatch) -> None:
    from ferry_mcp import server

    # patch_settings (autouse) laisse mcp_auth_enabled=False par défaut
    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token="should-not-be-used"))

    assert server._resolve_user_token() is None


def test_resolve_user_token_returns_clerk_token_when_authenticated(monkeypatch) -> None:
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token="clerk-upstream-token-xyz"))

    assert server._resolve_user_token() == "clerk-upstream-token-xyz"


def test_resolve_user_token_raises_explicitly_when_identity_missing(monkeypatch) -> None:
    """Auth activée mais aucune identité résolue : échec explicite, pas de fallback silencieux vers le compte service."""
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: None)

    with pytest.raises(RuntimeError, match="Clerk"):
        server._resolve_user_token()


def test_resolve_user_token_raises_when_token_empty(monkeypatch) -> None:
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token=""))

    with pytest.raises(RuntimeError, match="Clerk"):
        server._resolve_user_token()


# ---------------------------------------------------------------------------
# _client — headers
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_uses_bearer_header_when_token_given() -> None:
    from ferry_mcp import server

    client = server._client("clerk-upstream-token-xyz")
    try:
        assert client.headers.get("authorization") == "Bearer clerk-upstream-token-xyz"
        assert "x-api-key" not in client.headers
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_client_uses_service_api_key_when_no_token() -> None:
    from ferry_mcp import server

    client = server._client(None)
    try:
        assert client.headers.get("x-api-key") == "test-key-abc"
        assert "authorization" not in client.headers
    finally:
        await client.aclose()


# ---------------------------------------------------------------------------
# Intégration : un tool authentifié envoie bien le Bearer token au core
# ---------------------------------------------------------------------------

def _install_mock_transport(monkeypatch, server_module, handler) -> None:
    """Force le transport mocké sur les httpx.AsyncClient créés par `_client()`.

    `_client()` ne prend pas de transport en paramètre (il en crée un vrai
    pour parler au core) : on intercepte `httpx.AsyncClient` pour y injecter
    le MockTransport, plutôt que de monkeypatcher `_client` lui-même (ce qui
    contournerait justement le code qu'on veut tester).
    """
    real_async_client = httpx.AsyncClient

    def fake_async_client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(server_module.httpx, "AsyncClient", fake_async_client)


@pytest.mark.asyncio
async def test_search_library_sends_bearer_token_when_authenticated(monkeypatch) -> None:
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token="clerk-upstream-token-xyz"))

    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(200, json=[])

    _install_mock_transport(monkeypatch, server, handler)

    await server.search_library("Dune")

    req = captured[0]
    assert req.headers.get("authorization") == "Bearer clerk-upstream-token-xyz"
    assert "x-api-key" not in req.headers


@pytest.mark.asyncio
async def test_add_to_library_raises_instead_of_falling_back_to_service_account(monkeypatch) -> None:
    """Reproduit le bug corrigé : sans identité résolue (auth activée), on ne
    doit PLUS silencieusement retomber sur le compte service `mcp-service`.
    """
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: None)

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(201, json={"id": "lib-123"})

    _install_mock_transport(monkeypatch, server, handler)

    with pytest.raises(RuntimeError, match="Clerk"):
        await server.add_to_library("gutenberg", "r1")

    assert calls == [], "aucun appel au core ne doit partir sans identité résolue"
