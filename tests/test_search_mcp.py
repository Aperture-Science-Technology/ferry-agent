"""Optional MCP contract test, also runnable with the MCP environment."""

import json
from pathlib import Path

import httpx
import pytest


async def test_search_library_forwards_criteria_without_changing_tool_result(monkeypatch):
    pytest.importorskip("fastmcp")
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "mcp-server"))
    monkeypatch.setenv("MCP_AUTH_ENABLED", "false")
    from ferry_mcp import server

    filters = {"language": "fr", "formats": ["epub"], "author": "zola", "owned": True, "min_seeders": 3}
    row = {"title": "Germinal", "source": "gutenberg", "result_id": "1", "owned": True}
    bodies = []

    def handler(request):
        assert request.url.path == "/api/v1/books/search"
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=[row])

    monkeypatch.setattr(server, "_resolve_user_token", lambda: "test-token")
    monkeypatch.setattr(server, "_client", lambda token: httpx.AsyncClient(
        base_url="http://core.test", transport=httpx.MockTransport(handler)
    ))
    result = await server.search_library("book", scope=["legal"], filters=filters, sort="title", limit=10)
    assert bodies == [{"query": "book", "scope": ["legal"], "filters": filters, "sort": "title", "limit": 10}]
    assert result.structured_content == {"results": [row]}
    assert "Germinal" in result.content[0].text
    await server.search_library("book")
    assert bodies[1] == {"query": "book"}
