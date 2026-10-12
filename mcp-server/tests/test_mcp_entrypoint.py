"""Check the actual tool registry when the production entry point starts."""

import runpy
import sys
from pathlib import Path

import pytest
from fastmcp import FastMCP

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ferry_mcp import config


def test_delivery_tools_registered_before_http_start(monkeypatch) -> None:
    settings = config.MCPSettings(mcp_auth_enabled=False)
    monkeypatch.setattr(config, "get_settings", lambda: settings)
    registered_names: set[str] = set()

    class ServerStarted(Exception):
        """Stop execution at the point where the real HTTP server would block."""

    async def capture_tools_at_start(self, **kwargs):
        registered_names.update(tool.name for tool in await self.list_tools())
        raise ServerStarted

    monkeypatch.setattr(FastMCP, "run_http_async", capture_tools_at_start)

    # Execute the __main__ branch, as python -m does, without opening a socket.
    # Stop here so definitions below main() cannot register tools retroactively.
    with pytest.raises(ServerStarted):
        runpy.run_path(
            str(Path(__file__).resolve().parent.parent / "ferry_mcp" / "server.py"),
            run_name="__main__",
        )

    assert {"retry_delivery", "cancel_delivery"} <= registered_names
