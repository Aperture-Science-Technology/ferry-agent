"""Resilience des connecteurs de recherche livres gratuits."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from ferry_agent.connectors import Result
from ferry_agent.connectors.gutenberg import GutenbergConnector
from ferry_agent.services import library


class _OkConnector:
    name = "ok"

    async def search(self, query: str) -> list[Result]:
        return [
            Result(source=self.name, title=f"Book for {query}", result_id="1", format="epub")
        ]

    async def fetch(self, result_id: str) -> str:
        raise NotImplementedError


class _BoomConnector:
    name = "boom"

    async def search(self, query: str) -> list[Result]:
        raise RuntimeError("connector down")

    async def fetch(self, result_id: str) -> str:
        raise NotImplementedError


@pytest.mark.asyncio
async def test_search_all_isolates_connector_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "ferry_agent.connectors.registry.get_search_connectors",
        lambda: [_BoomConnector(), _OkConnector()],
    )
    results = await library.search_all("pride")
    assert len(results) == 1
    assert results[0].source == "ok"
    assert results[0].title == "Book for pride"


@pytest.mark.asyncio
async def test_search_all_skips_excluded_connectors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "ferry_agent.connectors.registry.get_search_connectors",
        lambda: [_OkConnector(), _BoomConnector()],
    )
    results = await library.search_all("pride", exclude={"ok"})
    assert results == []


@pytest.mark.asyncio
async def test_gutenberg_403_returns_empty_without_raising() -> None:
    response = httpx.Response(403, request=httpx.Request("GET", "https://gutendex.com/books/"))

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("ferry_agent.connectors.gutenberg.httpx.AsyncClient", return_value=mock_client):
        # Both gutendex and HTML fallback hit the same mocked client -> 403 each time.
        results = await GutenbergConnector().search("pride")

    assert results == []


@pytest.mark.asyncio
async def test_gutenberg_timeout_then_html_fallback() -> None:
    html = """
    <html><body><ul>
      <li class="booklink">
        <a class="link" href="/ebooks/1342">
          <span class="title">Pride and Prejudice</span>
          <span class="subtitle">Jane Austen</span>
        </a>
      </li>
    </ul></body></html>
    """
    html_resp = httpx.Response(
        200,
        text=html,
        request=httpx.Request("GET", "https://www.gutenberg.org/ebooks/search/"),
    )

    call_count = {"n": 0}

    async def fake_get(url, params=None):
        call_count["n"] += 1
        if "gutendex" in str(url):
            raise httpx.ReadTimeout("timed out")
        return html_resp

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=fake_get)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("ferry_agent.connectors.gutenberg.httpx.AsyncClient", return_value=mock_client):
        results = await GutenbergConnector().search("pride")

    assert len(results) == 1
    assert results[0].result_id == "1342"
    assert results[0].title == "Pride and Prejudice"
    assert results[0].author == "Jane Austen"
    # gutendex: 1 attempt + 1 retry, then HTML once
    assert call_count["n"] == 3


@pytest.mark.asyncio
async def test_standard_ebooks_parses_html_search() -> None:
    from ferry_agent.connectors.standard_ebooks import StandardEbooksConnector

    html = """
    <html><body>
      <ol class="ebooks-list grid">
        <li about="/ebooks/jane-austen/pride-and-prejudice" typeof="schema:Book">
          <p><a href="/ebooks/jane-austen/pride-and-prejudice" property="schema:name">Pride and Prejudice</a></p>
          <p class="author"><a href="/ebooks/jane-austen" property="schema:author">Jane Austen</a></p>
        </li>
      </ol>
    </body></html>
    """
    response = httpx.Response(
        200,
        text=html,
        request=httpx.Request("GET", "https://standardebooks.org/ebooks"),
    )

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "ferry_agent.connectors.standard_ebooks.httpx.AsyncClient", return_value=mock_client
    ):
        results = await StandardEbooksConnector().search("pride")

    assert len(results) == 1
    assert results[0].source == "standard_ebooks"
    assert results[0].title == "Pride and Prejudice"
    assert results[0].author == "Jane Austen"
    assert results[0].result_id == "/ebooks/jane-austen/pride-and-prejudice"
    assert results[0].format == "epub"
    mock_client.get.assert_awaited()
    args, kwargs = mock_client.get.await_args
    assert args[0] == "https://standardebooks.org/ebooks"
    assert kwargs["params"]["query"] == "pride"
