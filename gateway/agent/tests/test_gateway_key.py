"""FA-GATEWAY-KEY-01: private URLs stay in this process; all I/O is simulated."""

import json
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from agent_testkit import FakeTransmission, make_agent, make_settings
from ferry_gateway_agent.prowlarr import ProwlarrClient
from ferry_gateway_agent.transmission import TransmissionClient

SECRET = "test-only-indexer-secret"
URL = f"https://indexer.test/api?t=get&id=release-42&apikey={SECRET}"
RAW = {
    "title": "Auteur.-.Titre.FRENCH.2026.[EPUB]-NOTAG",
    "author": "Auteur inchangé",
    "size": 123456,
    "seeders": 83,
    "indexerId": 7,
    "guid": URL,
    "downloadUrl": URL,
}
DISPLAY = {
    "title": RAW["title"],
    "author": RAW["author"],
    "format": "epub",
    "size_bytes": RAW["size"],
    "seeders": RAW["seeders"],
    "indexer_id": RAW["indexerId"],
}


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    async def forbidden(*args, **kwargs):
        pytest.fail("A real HTTP transport must never be used")

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", forbidden)


def build_agent(state_path, download_root, prowlarr, handler=None):
    book = download_root / "book.epub"
    book.write_bytes(b"simulated ebook")
    transmission = FakeTransmission(
        torrent={
            "downloadDir": str(download_root),
            "files": [{"name": book.name, "length": book.stat().st_size, "bytesCompleted": book.stat().st_size}],
        }
    )
    # Include headers in the mock contract, just like TransmissionClient.add.
    transmission.add = AsyncMock(return_value=transmission.torrent_id)
    agent = make_agent(
        settings=make_settings(
            state_path=state_path, download_path=download_root, gateway_id="gw-1", gateway_key="gw-key"
        ),
        handler=handler or (lambda request: httpx.Response(200)),
        prowlarr=prowlarr,
        transmission=transmission,
    )
    return agent, transmission


@pytest.mark.parametrize("magnet", [None, "magnet:?xt=urn:btih:42"])
async def test_serialized_search_payload_has_no_private_urls(state_path, download_root, magnet):
    sent = []

    def platform(request):
        sent.append(json.loads(request.content))
        return httpx.Response(200)

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[{**RAW, "magnetUrl": magnet}]))
    ) as client:
        prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
        agent, _ = build_agent(state_path, download_root, prowlarr, platform)
        await agent._handle_search("search-job", {"query": "Titre"})
        result = sent[0][0]
        serialized = json.dumps(result)
        assert all(value not in serialized.lower() for value in ("apikey", "http://", "https://", SECRET))
        assert {key: result[key] for key in DISPLAY} == DISPLAY
        assert result["source"] == "prowlarr"
        if magnet:
            assert result["result_id"] == result["magnet_url"] == magnet
        else:
            assert result["result_id"].startswith("ferry-gw:7:")
            assert result["guid"] == result["result_id"]
        print("1-2. JSON transmis : " + serialized)
        print("1-2. Aucune URL ni clé ; champs d'affichage inchangés.")
        assert not state_path.exists()
        await agent.aclose()


@pytest.mark.parametrize("cache_state", ["hit", "restart", "expired"])
async def test_local_reference_fetch(state_path, download_root, monkeypatch, cache_state):
    requests = []
    current = dict(RAW)
    clock = SimpleNamespace(monotonic=lambda: 0)
    monkeypatch.setattr("ferry_gateway_agent.prowlarr.time", clock)

    def search(request):
        requests.append(request)
        return httpx.Response(200, json=[current])

    async with httpx.AsyncClient(transport=httpx.MockTransport(search)) as client:
        prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
        result = (await prowlarr.search("Titre"))[0]
        assert result["result_id"].startswith("ferry-gw:7:")
        expected = URL
        if cache_state != "hit":
            expected = URL.replace(SECRET, "rotated-test-only-key")
            current.update(guid=expected, downloadUrl=expected)
            if cache_state == "restart":
                prowlarr = ProwlarrClient("http://prowlarr.test", "key", client=client)
            else:
                clock.monotonic = lambda: 7200
        agent, transmission = build_agent(state_path, download_root, prowlarr)
        await agent._handle_fetch("fetch-job", {"result": result})
        transmission.add.assert_awaited_once_with(expected, paused=True)
        assert len(requests) == (1 if cache_state == "hit" else 2)
        if cache_state != "hit":
            assert requests[-1].url.params["query"] == RAW["title"]
        assert transmission.removed == [(7, True)]
        print(f"3-4. Cache={cache_state} : URL réelle vérifiée dans Transmission ; recherches={len(requests)}.")
        await agent.aclose()


@pytest.mark.parametrize("failure", ["missing", "other-indexer", "other-release", "http", "connection"])
async def test_missing_reference_fails_safely(state_path, download_root, failure):
    count = 0

    def search(request):
        nonlocal count
        count += 1
        if count == 1:
            return httpx.Response(200, json=[RAW])
        if failure == "http":
            return httpx.Response(500, text=URL)
        if failure == "connection":
            raise httpx.ConnectError(URL)
        if failure == "other-indexer":
            return httpx.Response(200, json=[{**RAW, "indexerId": 99}])
        if failure == "other-release":
            return httpx.Response(200, json=[{**RAW, "guid": URL.replace("release-42", "release-43")}])
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(transport=httpx.MockTransport(search)) as client:
        old = ProwlarrClient("http://prowlarr.test", "key", client=client)
        result = (await old.search("Titre"))[0]
        fresh = ProwlarrClient("http://prowlarr.test", "key", client=client)
        agent, transmission = build_agent(state_path, download_root, fresh)
        with pytest.raises(RuntimeError, match="Relancez la recherche") as error:
            await agent._handle_fetch("fetch-job", {"result": result})
        assert all(value not in str(error.value) for value in (SECRET, URL, "apikey"))
        assert count == 2
        transmission.add.assert_not_awaited()
        print(f"4. Échec {failure} : {error.value}")
        await agent.aclose()


@pytest.mark.parametrize("reference", ["magnet:?xt=urn:btih:42", URL, URL.replace("https:", "http:")])
@pytest.mark.parametrize("field", ["result_id", "guid", "download_url", "downloadUrl", "magnet_url", "magnetUrl"])
async def test_legacy_payload_is_accepted_unchanged(state_path, download_root, reference, field):
    agent, transmission = build_agent(state_path, download_root, None)
    await agent._handle_fetch("old-job", {"result": {field: reference, "title": RAW["title"]}})
    transmission.add.assert_awaited_once_with(reference, paused=True)
    transmission.start.assert_awaited_once_with(7)
    assert transmission.removed == [(7, True)]
    assert agent.prowlarr.queries == []
    print(f"5-6. Ancienne charge utile {field}/{reference.split(':', 1)[0]} acceptée et traitée sans altération.")
    await agent.aclose()


async def test_no_private_urls_in_cycle_or_cleanup_logs(state_path, download_root, caplog):
    agent, transmission = build_agent(state_path, download_root, None)
    transmission.remove_error = RuntimeError(URL)
    agent.poll_once = AsyncMock(
        return_value={
            "id": "fetch-job",
            "type": "fetch",
            "payload": {"result": {"guid": URL}},
        }
    )
    with caplog.at_level(logging.INFO):
        assert await agent.run_once() is True
        transmission.add.side_effect = RuntimeError(URL)
        assert await agent.run_once() is False
    assert "Could not clean up torrent" in caplog.text
    assert "Gateway cycle failed" in caplog.text
    assert all(value not in caplog.text for value in (URL, SECRET, "apikey"))
    print("Journaux nettoyage/échec : aucune URL privée ni clé.")
    await agent.aclose()


async def test_tracker_warning_and_http_logs_are_redacted(state_path, download_root, caplog):
    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, content=b"torrent")
        if json.loads(request.content)["method"] == "torrent-add":
            return httpx.Response(200, json={"result": "success", "arguments": {"torrent-added": {"id": 7}}})
        return httpx.Response(
            200,
            json={
                "result": "success",
                "arguments": {
                    "torrents": [
                        {
                            "id": 7,
                            "error": 1,
                            "errorString": f"tracker warning {URL}",
                            "percentDone": 1,
                        }
                    ]
                },
            },
        )

    agent, _ = build_agent(state_path, download_root, None)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transmission = TransmissionClient("http://transmission.test", client=client)
        with caplog.at_level(logging.INFO):
            await transmission.add(URL)
            await transmission.wait_until_done(7, timeout_seconds=1)
    assert "tracker warning" in caplog.text
    assert all(value not in caplog.text for value in (URL, SECRET, "apikey"))
    print("Journaux avertissement tracker/HTTP : aucune URL privée ni clé.")
    await agent.aclose()
