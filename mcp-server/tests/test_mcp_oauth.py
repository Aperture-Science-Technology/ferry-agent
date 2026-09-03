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
        mcp_base_url="https://ferry-agent.example.test",
    )
    provider = build_mcp_auth_provider()
    assert isinstance(provider, ClerkProvider)
