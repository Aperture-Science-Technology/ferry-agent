"""Read resources, Kindle prompt, and real module startup registration."""

import json
import runpy
import sys
from pathlib import Path

import httpx
import pytest
from fastmcp import Client, FastMCP

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ferry_mcp import config, server


@pytest.mark.parametrize(
    "uri,path,params,payload",
    [
        (
            "library://items",
            "/api/v1/books",
            {"page": "1", "limit": "50"},
            {"items": [{"id": "book", "title": "Livre"}], "total": 81, "page": 1, "limit": 50},
        ),
        (
            "library://items/2/10",
            "/api/v1/books",
            {"page": "2", "limit": "10"},
            {"items": [{"id": "other"}], "total": 81, "page": 2, "limit": 10},
        ),
        ("devices://list", "/api/v1/devices", {}, [{"id": "reader", "brand": "kindle"}]),
    ],
)
async def test_resources_delegate_authenticated_reads(monkeypatch, uri, path, params, payload):
    def handler(request):
        assert request.method == "GET"
        assert request.url.path == path
        assert dict(request.url.params) == params
        return httpx.Response(200, json=payload)

    def client(token):
        assert token == "resource-user"
        return httpx.AsyncClient(base_url="http://core.test", transport=httpx.MockTransport(handler))

    monkeypatch.setattr(server, "_resolve_user_token", lambda: "resource-user")
    monkeypatch.setattr(server, "_client", client)
    async with Client(server.mcp) as mcp_client:
        content = await mcp_client.read_resource(uri)
    assert json.loads(content[0].text) == payload


async def test_kindle_prompt_orders_steps_without_sending():
    async with Client(server.mcp) as client:
        prompt = await client.get_prompt("parcours-kindle")
    text = "\n".join(message.content.text for message in prompt.messages)
    assert (
        text.index("list_devices")
        < text.index("Send-to-Kindle")
        < text.index("Amazon")
        < text.index("deliver_to_kindle")
    )
    assert "confirm=True" in text
    assert "get_mail_settings" in text
    assert "accord" in text


def test_resources_and_prompt_exist_at_module_start(monkeypatch):
    monkeypatch.setattr(config, "get_settings", lambda: config.MCPSettings(mcp_auth_enabled=False))
    captured = {}

    class Started(Exception):
        pass

    async def capture(self, **kwargs):
        captured["resources"] = {str(r.uri) for r in await self.list_resources()}
        captured["prompts"] = {p.name for p in await self.list_prompts()}
        raise Started

    monkeypatch.setattr(FastMCP, "run_http_async", capture)
    with pytest.raises(Started):
        runpy.run_path(str(Path(server.__file__)), run_name="__main__")
    assert {"library://items", "devices://list"} <= captured["resources"]
    assert "parcours-kindle" in captured["prompts"]
