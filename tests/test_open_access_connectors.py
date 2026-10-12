"""FA-ECOSYSTEM-01 chantier 4 : Open Library + Internet Archive (hors ligne)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from ferry_agent.connectors.internet_archive import (
    InternetArchiveConnector,
    _METADATA_CONCURRENCY,
    _SEARCH_OVERALL_BUDGET,
    _SEARCH_TIMEOUT,
    is_lending_restricted,
    license_is_free,
    parse_search_docs,
    pick_downloadable_file,
    result_from_metadata,
)
from ferry_agent.connectors.open_library import (
    OpenLibraryConnector,
    is_publicly_downloadable,
    parse_search_docs as parse_ol_docs,
)
from ferry_agent.connectors.registry import get_search_connectors

FIXTURES = Path(__file__).parent / "fixtures" / "connectors"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_open_library_and_internet_archive_are_searchable() -> None:
    names = [c.name for c in get_search_connectors()]
    assert "open_library" in names
    assert "internet_archive" in names
    assert names.index("open_library") < names.index("internet_archive")


def test_open_library_parse_keeps_public_scan_excludes_borrowable() -> None:
    payload = _load("open_library_search.json")
    results = parse_ol_docs(payload["docs"])
    assert len(results) == 1
    assert results[0].source == "open_library"
    assert results[0].result_id == "/works/OL66554W"
    assert results[0].title == "Pride and Prejudice"
    assert results[0].author == "Jane Austen"
    assert results[0].format == "epub"
    assert results[0].cover_url and "14348537" in results[0].cover_url

    docs = {d["key"]: d for d in payload["docs"]}
    assert is_publicly_downloadable(docs["/works/OL66554W"]) is True
    assert is_publicly_downloadable(docs["/works/OL82563W"]) is False
    assert is_publicly_downloadable(docs["/works/OL99999W"]) is False


@pytest.mark.asyncio
async def test_open_library_search_uses_fixture_payload() -> None:
    payload = _load("open_library_search.json")
    response = httpx.Response(
        200,
        json=payload,
        request=httpx.Request("GET", "https://openlibrary.org/search.json"),
    )
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "ferry_agent.connectors.open_library.httpx.AsyncClient", return_value=mock_client
    ) as ctor:
        results = await OpenLibraryConnector().search("pride")

    assert [r.result_id for r in results] == ["/works/OL66554W"]
    args, kwargs = mock_client.get.await_args
    assert args[0] == "https://openlibrary.org/search.json"
    assert kwargs["params"]["q"] == "pride"
    assert ctor.call_args.kwargs["timeout"] <= 5.0


@pytest.mark.asyncio
async def test_open_library_timeout_and_network_error_return_empty() -> None:
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.ReadTimeout("timed out"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "ferry_agent.connectors.open_library.httpx.AsyncClient", return_value=mock_client
    ):
        assert await OpenLibraryConnector().search("pride") == []

    mock_client.get = AsyncMock(side_effect=httpx.ConnectError("down"))
    with patch(
        "ferry_agent.connectors.open_library.httpx.AsyncClient", return_value=mock_client
    ):
        assert await OpenLibraryConnector().search("pride") == []


def test_internet_archive_filters_lending_and_requires_free_license() -> None:
    search = _load("internet_archive_search.json")
    kept = parse_search_docs(search["response"]["docs"])
    assert [d["identifier"] for d in kept] == [
        "prideandprejudic42671gut",
        "dogri-pride-and-humility-tract",
    ]

    lending = next(
        d for d in search["response"]["docs"] if d["identifier"] == "prideprejudice0000jane"
    )
    assert is_lending_restricted(lending) is True
    assert license_is_free(lending) is False

    free_meta = _load("internet_archive_metadata_free.json")
    lending_meta = _load("internet_archive_metadata_lending.json")
    no_file_meta = _load("internet_archive_metadata_no_text_file.json")

    free = result_from_metadata("prideandprejudic42671gut", free_meta)
    assert free is not None
    assert free.source == "internet_archive"
    assert free.format == "epub"

    assert result_from_metadata("prideprejudice0000jane", lending_meta) is None
    assert is_lending_restricted(lending_meta["metadata"]) is True
    assert result_from_metadata("dogri-pride-and-humility-tract", no_file_meta) is None
    assert pick_downloadable_file(no_file_meta["files"]) is None
    assert pick_downloadable_file(free_meta["files"]) == ("pg42671.epub", "epub")


@pytest.mark.asyncio
async def test_internet_archive_search_excludes_lending_via_metadata() -> None:
    search = _load("internet_archive_search.json")
    free_meta = _load("internet_archive_metadata_free.json")
    lending_meta = _load("internet_archive_metadata_lending.json")
    no_file_meta = _load("internet_archive_metadata_no_text_file.json")

    search_resp = httpx.Response(
        200,
        json=search,
        request=httpx.Request("GET", "https://archive.org/advancedsearch.php"),
    )

    async def fake_get(url, params=None):
        url_s = str(url)
        if "advancedsearch" in url_s:
            return search_resp
        if url_s.endswith("/prideandprejudic42671gut"):
            return httpx.Response(200, json=free_meta, request=httpx.Request("GET", url_s))
        if url_s.endswith("/prideprejudice0000jane"):
            return httpx.Response(
                200, json=lending_meta, request=httpx.Request("GET", url_s)
            )
        if url_s.endswith("/dogri-pride-and-humility-tract"):
            return httpx.Response(
                200, json=no_file_meta, request=httpx.Request("GET", url_s)
            )
        raise AssertionError(f"unexpected url {url_s}")

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=fake_get)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "ferry_agent.connectors.internet_archive.httpx.AsyncClient",
        return_value=mock_client,
    ) as ctor:
        results = await InternetArchiveConnector().search("pride")

    assert [r.result_id for r in results] == ["prideandprejudic42671gut"]
    assert results[0].format == "epub"
    # Timeout httpx borne par le budget interne (sous le plafond agrege 15 s).
    assert ctor.call_args.kwargs["timeout"] <= _SEARCH_OVERALL_BUDGET
    assert _SEARCH_OVERALL_BUDGET <= 12.0
    assert _SEARCH_OVERALL_BUDGET < _SEARCH_TIMEOUT


@pytest.mark.asyncio
async def test_internet_archive_metadata_fetched_in_parallel() -> None:
    """N metadonnees lentes : le temps total ~ max, pas N * latence (semaphore)."""
    n = 8
    per_meta_delay = 0.35
    # Sequentiel : 8 * 0,35 = 2,8 s. Parallele (concurrency 4) : 2 vagues ~ 0,7 s.
    sequential_floor = n * per_meta_delay
    assert _METADATA_CONCURRENCY >= 2
    assert sequential_floor > 1.5

    docs = [
        {
            "identifier": f"ia-parallel-{i}",
            "title": f"Title {i}",
            "creator": "Author",
            "licenseurl": "https://creativecommons.org/publicdomain/zero/1.0/",
            "mediatype": "texts",
            "collection": ["gutenberg"],
        }
        for i in range(n)
    ]
    search = {"response": {"docs": docs}}
    free_meta = _load("internet_archive_metadata_free.json")
    started: list[float] = []
    max_in_flight = 0
    in_flight = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal max_in_flight, in_flight
        url_s = str(request.url)
        if "advancedsearch" in url_s:
            return httpx.Response(200, json=search)
        in_flight += 1
        max_in_flight = max(max_in_flight, in_flight)
        started.append(asyncio.get_running_loop().time())
        try:
            await asyncio.sleep(per_meta_delay)
            return httpx.Response(200, json=free_meta)
        finally:
            in_flight -= 1

    real_async_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        return real_async_client(
            transport=httpx.MockTransport(handler),
            timeout=kwargs.get("timeout", _SEARCH_TIMEOUT),
            headers=kwargs.get("headers"),
        )

    t0 = asyncio.get_running_loop().time()
    with patch(
        "ferry_agent.connectors.internet_archive.httpx.AsyncClient",
        side_effect=client_factory,
    ):
        results = await InternetArchiveConnector().search("parallel")
    elapsed = asyncio.get_running_loop().time() - t0

    assert len(results) == n
    assert max_in_flight <= _METADATA_CONCURRENCY
    assert max_in_flight >= 2
    # Preuve anti-regression : pas de parcours sequentiel (temps << somme).
    assert elapsed < sequential_floor * 0.6


@pytest.mark.asyncio
async def test_internet_archive_budget_returns_partial_results() -> None:
    """Budget epuise : renvoyer les Result deja valides, pas une liste vide."""
    free_meta = _load("internet_archive_metadata_free.json")
    docs = [
        {
            "identifier": f"ia-budget-{i}",
            "title": f"Title {i}",
            "creator": "Author",
            "licenseurl": "https://creativecommons.org/publicdomain/zero/1.0/",
            "mediatype": "texts",
            "collection": ["gutenberg"],
        }
        for i in range(6)
    ]
    search = {"response": {"docs": docs}}

    async def handler(request: httpx.Request) -> httpx.Response:
        url_s = str(request.url)
        if "advancedsearch" in url_s:
            return httpx.Response(200, json=search)
        # Assez lent pour que le budget coupe avant la fin de toutes les taches.
        await asyncio.sleep(0.4)
        return httpx.Response(200, json=free_meta)

    real_async_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        return real_async_client(
            transport=httpx.MockTransport(handler),
            timeout=kwargs.get("timeout", _SEARCH_TIMEOUT),
            headers=kwargs.get("headers"),
        )

    with (
        patch(
            "ferry_agent.connectors.internet_archive._SEARCH_OVERALL_BUDGET",
            0.5,
        ),
        patch(
            "ferry_agent.connectors.internet_archive.httpx.AsyncClient",
            side_effect=client_factory,
        ),
    ):
        results = await InternetArchiveConnector().search("budget")

    # Premiere vague (concurrency 4) peut terminer ; le reste est annule.
    assert 0 < len(results) < 6


@pytest.mark.asyncio
async def test_internet_archive_search_succeeds_when_api_is_slower_than_5s() -> None:
    """advancedsearch a 6,5 s echouait avec l'ancien timeout (5 s) ; passe a 15 s.

    Transport httpx reel (MockTransport) : le timeout httpx est exerce,
    pas seulement la valeur de la constante.
    """
    search = _load("internet_archive_search.json")
    free_meta = _load("internet_archive_metadata_free.json")
    no_file_meta = _load("internet_archive_metadata_no_text_file.json")
    # Delai entre l'ancien plafond (5 s) et le nouveau (15 s).
    slow_delay_s = 6.5
    assert 5.0 < slow_delay_s < _SEARCH_TIMEOUT

    async def handler(request: httpx.Request) -> httpx.Response:
        url_s = str(request.url)
        if "advancedsearch" in url_s:
            await asyncio.sleep(slow_delay_s)
            return httpx.Response(200, json=search)
        if url_s.rstrip("/").endswith("/prideandprejudic42671gut"):
            return httpx.Response(200, json=free_meta)
        if url_s.rstrip("/").endswith("/dogri-pride-and-humility-tract"):
            return httpx.Response(200, json=no_file_meta)
        return httpx.Response(404, json={})

    # Garder la vraie classe : le patch remplace httpx.AsyncClient sur le
    # module partage, donc un appel direct a httpx.AsyncClient recursait.
    real_async_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        return real_async_client(
            transport=httpx.MockTransport(handler),
            timeout=kwargs.get("timeout", _SEARCH_TIMEOUT),
            headers=kwargs.get("headers"),
        )

    with patch(
        "ferry_agent.connectors.internet_archive.httpx.AsyncClient",
        side_effect=client_factory,
    ):
        results = await InternetArchiveConnector().search("pride")

    assert [r.result_id for r in results] == ["prideandprejudic42671gut"]
    assert results[0].format == "epub"


@pytest.mark.asyncio
async def test_internet_archive_timeout_returns_empty() -> None:
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.ReadTimeout("timed out"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "ferry_agent.connectors.internet_archive.httpx.AsyncClient",
        return_value=mock_client,
    ):
        assert await InternetArchiveConnector().search("pride") == []


@pytest.mark.asyncio
async def test_internet_archive_unreadable_json_returns_empty() -> None:
    response = httpx.Response(
        200,
        text="not-json",
        request=httpx.Request("GET", "https://archive.org/advancedsearch.php"),
    )
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "ferry_agent.connectors.internet_archive.httpx.AsyncClient",
        return_value=mock_client,
    ):
        assert await InternetArchiveConnector().search("pride") == []
