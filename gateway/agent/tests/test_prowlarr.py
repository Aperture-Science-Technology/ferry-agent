"""ProwlarrClient request formatting."""

from __future__ import annotations

import httpx
import pytest
from ferry_gateway_agent.prowlarr import BOOK_CATEGORIES, DownloadReferenceError, ProwlarrClient


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
    assert request.url.params.get_list("categories") == [str(category) for category in BOOK_CATEGORIES]
    assert ",".join(map(str, BOOK_CATEGORIES)) not in str(request.url)


@pytest.mark.asyncio
async def test_search_keeps_result_with_only_download_url():
    url = "http://prowlarr.test/download/book.torrent"
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json=[
                {
                    "title": "Book.epub",
                    "downloadUrl": url,
                }
            ],
        )
    )
    async with httpx.AsyncClient(transport=transport) as client:
        prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
        results = await prowlarr.search("Book")
        assert len(results) == 1
        assert await prowlarr.resolve(results[0]["result_id"], title="Book") == url
    assert len(results) == 1
    assert results[0]["result_id"].startswith("ferry-gw:0:")
    assert results[0]["guid"] == results[0]["result_id"]
    assert results[0]["download_url"] is None


@pytest.mark.parametrize("identity_field", ["guid", "downloadUrl"])
async def test_identity_survives_key_rotation_and_query_order(identity_field):
    urls = [
        "https://user:old@indexer.test/api?id=42&API_KEY=old&token=old#old",
        "https://user:new@indexer.test/api?token=new&id=42&API_KEY=new#new",
        "https://indexer.test/api?token=new&id=43&API_KEY=new",
    ]
    rows = [{identity_field: url, "indexerId": 7} for url in urls]
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=rows))
    ) as client:
        results = await ProwlarrClient("http://prowlarr.test", "key", client=client).search("Book")
    first, second, other = [result["result_id"] for result in results]
    assert first == second
    assert first != other


async def test_download_link_selector_distinguishes_releases():
    from urllib.parse import urlencode

    rows = [
        {
            "downloadUrl": "http://prowlarr.test/7/download?"
            + urlencode(
                {
                    "apikey": key,
                    "link": f"https://indexer.test/download?id={release}&apikey={key}",
                }
            ),
            "indexerId": 7,
        }
        for release, key in [(42, "old"), (42, "new"), (43, "new")]
    ]
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=rows))
    ) as client:
        results = await ProwlarrClient("http://prowlarr.test", "key", client=client).search("Book")
    assert results[0]["result_id"] == results[1]["result_id"]
    assert results[0]["result_id"] != results[2]["result_id"]


async def test_cache_is_bounded_and_evicted_result_is_researched(monkeypatch):
    monkeypatch.setattr("ferry_gateway_agent.prowlarr.CACHE_MAX_ENTRIES", 2)
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            200,
            json=[
                {
                    "title": "Book",
                    "indexerId": 7,
                    "guid": f"release-{number}",
                    "downloadUrl": f"https://indexer.test/{number}?apikey=private",
                }
                for number in ([1, 2, 3] if len(calls) == 1 else [1])
            ],
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
        results = await prowlarr.search("Book")
        assert len(prowlarr._download_cache) == 2
        assert results[0]["result_id"] not in prowlarr._download_cache
        assert await prowlarr.resolve(results[0]["result_id"], title="Book") == "https://indexer.test/1?apikey=private"
        assert len(calls) == 2
        assert len(prowlarr._download_cache) == 2
        await prowlarr.aclose()
        assert not prowlarr._download_cache


async def test_metadata_and_guid_only_result_are_preserved():
    metadata = {"language": "fr", "isbn": "9782266282362", "page_count": 320}
    url = "https://indexer.test/book.pdf?apikey=private"
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[{"guid": url, **metadata}, None, {}]))
    ) as client:
        prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
        results = await prowlarr.search("Book")
        assert len(results) == 1
        assert results[0]["format"] == "pdf"
        assert {key: results[0][key] for key in metadata} == metadata
        assert await prowlarr.resolve(results[0]["result_id"], title="Book") == url


async def test_missing_title_and_unusable_guid_fail_explicitly():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=[{"guid": "release-42", "title": "Book"}])

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
        result = (await prowlarr.search("Book"))[0]
        for title in ("", "Book"):
            with pytest.raises(DownloadReferenceError, match="Relancez la recherche"):
                await prowlarr.resolve(result["result_id"], title=title)
        assert len(requests) == 2
