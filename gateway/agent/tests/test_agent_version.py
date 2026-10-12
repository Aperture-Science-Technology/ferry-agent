from importlib import metadata

import httpx
import pytest
from agent_testkit import make_agent, make_settings


@pytest.mark.parametrize("installed", ["0.2.3", None])
async def test_every_poll_sends_installed_version_or_unknown(monkeypatch, state_path, download_root, installed):
    def version(package):
        assert package == "ferry_gateway_agent"
        if installed is None:
            raise metadata.PackageNotFoundError(package)
        return installed

    monkeypatch.setattr("ferry_gateway_agent.worker.metadata.version", version)
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(204)

    agent = make_agent(
        settings=make_settings(state_path=state_path, download_path=download_root, gateway_id="gw", gateway_key="key"),
        handler=handler,
    )
    try:
        await agent.poll_once()
        await agent.poll_once()
        assert [r.headers["X-Gateway-Version"] for r in requests] == [installed or "unknown"] * 2
    finally:
        await agent.platform.aclose()
