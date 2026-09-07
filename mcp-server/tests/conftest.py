"""Pytest bootstrap for ferry-mcp.

Force MCP_AUTH_ENABLED=false before any import of ferry_mcp.server so that
module-level FastMCP(auth=build_mcp_auth_provider()) does not require a full
Clerk OAuth config during unit tests. Production defaults remain True in code.
"""

import os

os.environ.setdefault("MCP_AUTH_ENABLED", "false")
