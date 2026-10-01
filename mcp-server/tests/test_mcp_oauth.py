"""Tests du provider OAuth Clerk pour le serveur MCP."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import ferry_mcp.config as _cfg_module
from ferry_mcp.config import MCPSettings
from ferry_mcp import server as mcp_server
from ferry_mcp.server import build_mcp_auth_provider


def _patch_settings(monkeypatch, **kwargs) -> None:
    settings = MCPSettings(**kwargs)
    _cfg_module.get_settings.cache_clear()
    monkeypatch.setattr(_cfg_module, "get_settings", lambda: settings)
    monkeypatch.setattr(mcp_server, "get_settings", lambda: settings)


def test_auth_disabled_returns_none(monkeypatch) -> None:
    _patch_settings(monkeypatch, mcp_auth_enabled=False)
    assert build_mcp_auth_provider() is None


def test_auth_enabled_incomplete_raises(monkeypatch) -> None:
    _patch_settings(
        monkeypatch,
        mcp_auth_enabled=True,
        clerk_domain="",
        clerk_oauth_client_id="",
        clerk_oauth_client_secret="",
    )
    with pytest.raises(RuntimeError, match="incomplete"):
        build_mcp_auth_provider()


def test_auth_enabled_complete_returns_clerk_provider(monkeypatch) -> None:
    from fastmcp.server.auth.providers.clerk import ClerkProvider

    _patch_settings(
        monkeypatch,
        mcp_auth_enabled=True,
        clerk_domain="clerk.example.test",
        clerk_oauth_client_id="oauth_client_id_test",
        clerk_oauth_client_secret="oauth_client_secret_test",
        mcp_base_url="https://ferry-agent.example.test/",
        mcp_jwt_signing_key="-".join(["unit", "test", "signing", "key"]),
    )
    provider = build_mcp_auth_provider()
    assert isinstance(provider, ClerkProvider)
    # On passe issuer_url sans slash ; Pydantic AnyHttpUrl (FastMCP) peut
    # republier avec slash — écart documenté ADR 0011.
    assert "ferry-agent.example.test" in str(provider.issuer_url)
    # scopes → WWW-Authenticate scope="…" via challenge_scopes / required_scopes
    assert provider.required_scopes == ["openid", "email", "profile"]
    assert "openid" in (provider.challenge_scopes or provider.required_scopes)


def test_auth_disabled_forbidden_in_production() -> None:
    with pytest.raises(Exception, match="production"):
        MCPSettings(app_env="production", mcp_auth_enabled=False)


def test_http_middleware_wildcard_cors() -> None:
    from ferry_mcp.server import _http_middleware_and_origins

    settings = MCPSettings(mcp_allowed_origins="*")
    middleware, guard_origins = _http_middleware_and_origins(settings)
    assert guard_origins is None
    assert len(middleware) == 1


def test_http_middleware_cors_allow_headers_include_protocol() -> None:
    """Régression : CORS doit autoriser les en-têtes MCP 2026-07-28."""
    from ferry_mcp.server import _http_middleware_and_origins

    settings = MCPSettings(mcp_allowed_origins="*")
    middleware, _ = _http_middleware_and_origins(settings)
    allow_headers = {h.lower() for h in middleware[0].kwargs["allow_headers"]}
    required = {
        "mcp-protocol-version",
        "mcp-method",
        "mcp-name",
        "authorization",
        "content-type",
    }
    assert required <= allow_headers


def test_http_middleware_closed_list_refuses_unknown() -> None:
    from ferry_mcp.server import _http_middleware_and_origins

    settings = MCPSettings(
        mcp_allowed_origins="https://claude.ai,https://chatgpt.com",
    )
    middleware, guard_origins = _http_middleware_and_origins(settings)
    assert guard_origins == ["https://claude.ai", "https://chatgpt.com"]
    assert len(middleware) == 1
