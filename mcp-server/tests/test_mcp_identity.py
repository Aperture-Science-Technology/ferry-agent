"""Tests de la propagation d'identité utilisateur MCP → core.

Vérifie que, lorsqu'un utilisateur Clerk authentifié (OAuth) appelle un
tool MCP, le core reçoit un Bearer — jeton Clerk amont (repli) ou assertion
Ed25519 (`aud=ferry-core`) si la clé privée est configurée — et qu'aucun
fallback compte-service n'existe plus si l'identité manque.

Couvre aussi l'isolation entre utilisateurs : le Bearer transmis est
strictement celui de l'appelant courant.
"""

import base64
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

import ferry_mcp.config as _cfg_module
from ferry_mcp.assertion import (
    ASSERTION_AUDIENCE,
    ASSERTION_ISSUER,
    ASSERTION_MAX_TTL_SECONDS,
)
from ferry_mcp.config import MCPSettings


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    settings = MCPSettings(
        ferry_core_url="http://test-core:8000",
        port=8001,
        mcp_auth_enabled=False,
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


def _enable_auth(monkeypatch, **extra) -> MCPSettings:
    """Bascule la config en mode OAuth (mcp_auth_enabled=True).

    Le fixture `patch_settings` (autouse) a déjà remplacé `get_settings` par
    un lambda sans cache : pas de `cache_clear()` à refaire ici.
    """
    settings = MCPSettings(
        ferry_core_url="http://test-core:8000",
        port=8001,
        mcp_auth_enabled=True,
        **extra,
    )
    monkeypatch.setattr(_cfg_module, "get_settings", lambda: settings)
    from ferry_mcp import server

    monkeypatch.setattr(server, "get_settings", lambda: settings)
    return settings


def _ed25519_pair_b64() -> tuple[str, str, bytes]:
    private_key = ed25519.Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return (
        base64.b64encode(private_pem).decode("ascii"),
        base64.b64encode(public_pem).decode("ascii"),
        public_pem,
    )


# ---------------------------------------------------------------------------
# _resolve_user_token — unité
# ---------------------------------------------------------------------------

def test_resolve_user_token_raises_when_auth_disabled(monkeypatch) -> None:
    """Sans identité Clerk, même auth désactivée : pas de fallback, RuntimeError."""
    from ferry_mcp import server

    monkeypatch.setattr(server, "get_access_token", lambda: None)

    with pytest.raises(RuntimeError, match="Clerk"):
        server._resolve_user_token()


def test_resolve_user_token_returns_clerk_token_when_authenticated(monkeypatch) -> None:
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token="clerk-upstream-token-xyz"))

    assert server._resolve_user_token() == "clerk-upstream-token-xyz"


def test_resolve_user_token_raises_explicitly_when_identity_missing(monkeypatch) -> None:
    """Auth activée mais aucune identité résolue : échec explicite, pas de fallback."""
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


def test_resolve_user_token_forges_assertion_when_private_key_configured(monkeypatch) -> None:
    from ferry_mcp import server

    private_b64, _, public_pem = _ed25519_pair_b64()
    _enable_auth(monkeypatch, mcp_core_assertion_private_key_b64=private_b64)
    monkeypatch.setattr(
        server,
        "get_access_token",
        lambda: SimpleNamespace(
            token="clerk-upstream-unused",
            subject="user_abc",
            claims={"sub": "user_abc", "email": "reader@example.test", "email_verified": True},
        ),
    )

    token = server._resolve_user_token()
    assert token != "clerk-upstream-unused"

    payload = jwt.decode(
        token,
        public_pem,
        algorithms=["EdDSA"],
        audience=ASSERTION_AUDIENCE,
        issuer=ASSERTION_ISSUER,
        options={"verify_aud": True, "verify_iss": True},
    )
    assert payload["sub"] == "user_abc"
    assert payload["email"] == "reader@example.test"
    assert payload["exp"] - payload["iat"] <= ASSERTION_MAX_TTL_SECONDS
    assert payload["exp"] - payload["iat"] == 120
    assert "jti" in payload


def test_resolve_user_token_fallback_without_private_key(monkeypatch) -> None:
    from ferry_mcp import server

    _enable_auth(monkeypatch, mcp_core_assertion_private_key_b64="")
    monkeypatch.setattr(
        server,
        "get_access_token",
        lambda: SimpleNamespace(
            token="clerk-upstream-token-xyz",
            claims={"sub": "u", "email": "a@b.c"},
        ),
    )
    assert server._resolve_user_token() == "clerk-upstream-token-xyz"


def test_resolve_user_token_incomplete_identity_no_email(monkeypatch) -> None:
    from ferry_mcp import server

    private_b64, _, _ = _ed25519_pair_b64()
    _enable_auth(monkeypatch, mcp_core_assertion_private_key_b64=private_b64)
    monkeypatch.setattr(
        server,
        "get_access_token",
        lambda: SimpleNamespace(
            token="clerk-upstream",
            subject="user_abc",
            claims={"sub": "user_abc", "email_verified": True},
        ),
    )

    with pytest.raises(RuntimeError, match="email manquant"):
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
async def test_client_without_token_raises() -> None:
    from ferry_mcp import server

    with pytest.raises(RuntimeError, match="Token utilisateur Clerk requis"):
        server._client(None)


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
    """Sans identité résolue, on ne doit plus retomber sur un compte service."""
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


@pytest.mark.asyncio
async def test_user_isolation_bearer_follows_caller_identity(monkeypatch) -> None:
    """Deux utilisateurs successifs : chaque tool relaie UNIQUEMENT son propre Bearer.

    Régression d'isolation : pas de token partagé / sticky entre appels.
    """
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    captured: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        path = req.url.path
        if path == "/api/v1/books":
            return httpx.Response(
                200,
                json={"items": [], "total": 0, "page": 1, "limit": 50},
            )
        if path == "/api/v1/devices":
            return httpx.Response(200, json=[])
        if path == "/api/v1/gateways":
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=[])

    _install_mock_transport(monkeypatch, server, handler)

    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token="token-user-A"))
    await server.list_library()
    await server.list_devices()

    monkeypatch.setattr(server, "get_access_token", lambda: SimpleNamespace(token="token-user-B"))
    await server.list_gateways()
    await server.list_library()

    assert len(captured) == 4
    assert captured[0].headers.get("authorization") == "Bearer token-user-A"
    assert captured[1].headers.get("authorization") == "Bearer token-user-A"
    assert captured[2].headers.get("authorization") == "Bearer token-user-B"
    assert captured[3].headers.get("authorization") == "Bearer token-user-B"
    assert all("x-api-key" not in req.headers for req in captured)


@pytest.mark.asyncio
async def test_deliver_and_gateway_tools_require_identity(monkeypatch) -> None:
    """Outils d'écriture / catalogue : pas d'appel core sans identité."""
    from ferry_mcp import server

    _enable_auth(monkeypatch)
    monkeypatch.setattr(server, "get_access_token", lambda: None)

    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        return httpx.Response(200, json=[])

    _install_mock_transport(monkeypatch, server, handler)

    with pytest.raises(RuntimeError, match="Clerk"):
        await server.deliver("item", "device", confirm=True, method="email")
    with pytest.raises(RuntimeError, match="Clerk"):
        await server.get_gateway_job("job-1")
    with pytest.raises(RuntimeError, match="Clerk"):
        await server.list_opds_tokens()

    assert calls == []
