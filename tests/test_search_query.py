"""Search criteria are applied to the merged list before pagination."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from ferry_agent.api import books
from ferry_agent.api.deps import CurrentUser
from ferry_agent.models import GatewayJobStatus, SourceType
from ferry_agent.schemas import Result, SearchRequest
from tests.fakes import FakeSession


@pytest.fixture
def search(monkeypatch):
    gateway = SimpleNamespace(id=uuid.uuid4())
    legal = [
        Result(source="gutenberg", result_id="1", title="Éclair", author="Émile Zola",
               language="FR", format="EPUB", size_bytes=30),
        Result(source="standard_ebooks", result_id="2", title="alpha", author="Ábel",
               language="en", format="pdf", size_bytes=10),
        Result(source="gutenberg", result_id="3", title="Zulu", author="zola",
               language="fr", size_bytes=50),
    ]
    remote = [
        Result(source=f"gateway:{gateway.id}", result_id="4", title="Beta", author="émile",
               language="fr", size_bytes=20, seeders=7),
        Result(source=f"gateway:{gateway.id}", result_id="5", title="Omega", size_bytes=80, seeders=1),
        Result(source=f"gateway:{gateway.id}", result_id="6", title="Unknown", size_bytes=0),
    ]
    job = SimpleNamespace(status=GatewayJobStatus.done,
                          payload={"results": [r.model_dump() for r in remote]})
    create = AsyncMock(return_value=job)
    monkeypatch.setattr(books.gateway_service, "online_gateways", AsyncMock(return_value=[gateway]))
    monkeypatch.setattr(books.gateway_service, "create_job", create)
    monkeypatch.setattr(books.library, "search_all", AsyncMock(return_value=legal))
    owned = SimpleNamespace(title="different", author="", isbn=None, source_ref="gutenberg:1")

    async def run(**criteria):
        db = FakeSession(execute_values=[[], [(owned, SourceType.gutenberg)]])
        return await books.search_books(
            SearchRequest(query="book", **criteria), CurrentUser(uuid.uuid4(), "test@example.test"), db
        )

    return run, create


@pytest.mark.parametrize("criteria,expected", [
    ({}, ["Éclair", "alpha", "Zulu", "Beta", "Omega", "Unknown"]),
    ({"filters": {"language": "FR", "formats": ["epub"], "author": "EMILE"}}, ["Éclair", "Beta"]),
    ({"filters": {"sources": ["standard_ebooks"]}}, ["alpha"]),
    ({"filters": {"sources": ["gateway"]}}, ["Beta", "Omega", "Unknown"]),
    ({"filters": {"sources": []}}, []),
    ({"filters": {"formats": []}}, []),
    ({"filters": {"owned": True}}, ["Éclair"]),
    ({"filters": {"owned": False}, "limit": 1}, ["alpha"]),
    ({"filters": {"min_seeders": 3}}, ["Éclair", "alpha", "Zulu", "Beta"]),
    ({"filters": {"max_size_bytes": 20}}, ["alpha", "Beta", "Unknown"]),
    ({"sort": "title"}, ["alpha", "Beta", "Éclair", "Omega", "Unknown", "Zulu"]),
    ({"sort": "author"}, ["Omega", "Unknown", "alpha", "Beta", "Éclair", "Zulu"]),
    ({"sort": "size"}, ["Omega", "Zulu", "Éclair", "Beta", "alpha", "Unknown"]),
    ({"sort": "seeders"}, ["Beta", "Omega", "Éclair", "alpha", "Zulu", "Unknown"]),
    ({"sort": "relevance"}, ["Éclair", "alpha", "Zulu", "Beta", "Omega", "Unknown"]),
    ({"filters": {"language": "fr"}, "sort": "title", "offset": 1, "limit": 1}, ["Éclair"]),
    ({"offset": 4}, ["Omega", "Unknown"]),
    ({"offset": 200}, []),
])
async def test_search_filters_sort_then_page(search, criteria, expected):
    run, _ = search
    results = await run(**criteria)
    assert [r.title for r in results] == expected


async def test_gateway_job_receives_filters(search):
    run, create = search
    filters = {"min_seeders": 3, "max_size_bytes": 42, "owned": False}
    await run(filters=filters)
    assert create.call_args.args[3] == {"query": "book", "filters": filters}


@pytest.mark.parametrize("criteria", [{"limit": 0}, {"limit": 201}, {"offset": -1}, {"sort": "bad"}])
def test_invalid_search_criteria(criteria):
    with pytest.raises(ValidationError):
        SearchRequest(query="book", **criteria)
