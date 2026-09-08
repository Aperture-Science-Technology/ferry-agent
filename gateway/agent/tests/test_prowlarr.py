"""ProwlarrClient request formatting."""

from __future__ import annotations

import httpx
import pytest

from ferry_gateway_agent.prowlarr import BOOK_CATEGORIES, ProwlarrClient


@pytest.mark.asyncio
async def test_search_sends_categories_as_repeated_params() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=[])

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        prowlarr = ProwlarrClient(
            "http://prowlarr.test",
            "prowlarr-key",
            client=client,
        )
        await prowlarr.search("dune")

    assert len(captured) == 1
    request = captured[0]
    assert request.url.path == "/api/v1/search"
    assert request.headers.get("X-Api-Key") == "prowlarr-key"
    assert request.url.params.get("query") == "dune"
    assert request.url.params.get("type") == "search"
    assert request.url.params.get_list("categories") == [
        str(category) for category in BOOK_CATEGORIES
    ]
    assert ",".join(map(str, BOOK_CATEGORIES)) not in str(request.url)
