"""Régressions F01 à F04, sans envoi réel."""

import json

import httpx
import pytest
from fastmcp import Client
from ferry_mcp import server


@pytest.fixture
def backend(monkeypatch):
    """Simule les réponses REST et conserve les modifications pour relecture."""
    state = {
        "book": {
            "id": "livre",
            "title": "Orgueil et Préjugés",
            "author": "Jane Austen",
            "original_format": "epub",
            "language": "fr",
            "page_count": None,
        },
        "device": {
            "id": "liseuse",
            "brand": "kindle",
            "name": "Salon",
            "model": "PW",
            "delivery_tier": "A",
            "conversion_profile": None,
        },
        "book_status": 200,
        "target_format": "epub",
        "requests": [],
    }

    def handler(req):
        state["requests"].append(req)
        path = req.url.path
        if path == "/api/v1/books/search":
            return httpx.Response(200, json=[state["result"]])
        if path == "/api/v1/books" and req.method == "POST":
            body = json.loads(req.content)
            return httpx.Response(201, json={"id": "livre", **body.get("result", {})})
        if path == "/api/v1/books/livre":
            if req.method == "PATCH":
                state["book"].update(json.loads(req.content))
            return httpx.Response(state["book_status"], json=state["book"])
        if path == "/api/v1/devices/liseuse":
            if req.method == "PATCH":
                state["device"].update(json.loads(req.content))
            return httpx.Response(200, json=state["device"])
        if path == "/api/v1/devices":
            return httpx.Response(200, json=[state["device"]])
        if path.endswith("/methods"):
            return httpx.Response(200, json=[{"method": "email", "available": True}])
        if path == "/api/v1/users/me":
            return httpx.Response(200, json={"kindle_email": "moi@kindle.com", "default_format": "epub"})
        if path == "/api/v1/deliveries/preview":
            return httpx.Response(200, json={"target_format": state["target_format"]})
        if path == "/api/v1/deliveries" and req.method == "POST":
            return httpx.Response(201, json={"id": "envoi", "status": "queued"})
        return httpx.Response(404)

    monkeypatch.setattr(server, "_resolve_user_token", lambda: "identite-test")
    monkeypatch.setattr(
        server,
        "_client",
        lambda token=None: httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test"),
    )
    return state


@pytest.mark.parametrize("source", ["gutenberg", "gateway:exemple"])
async def test_f01_search_add_preserves_structured_result(backend, source):
    """Le transport MCP conserve tous les champs jusqu'au corps d'import REST."""
    selected = {
        "source": source,
        "result_id": "1342",
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "language": "en",
        "isbn": "9780141439518",
        "cover_url": "https://www.gutenberg.org/cover.jpg",
        "guid": "reference",
    }
    backend["result"] = selected
    async with Client(server.mcp) as client:
        found = await client.call_tool("search_library", {"query": "Pride"})
        assert found.structured_content["results"] == [selected]
        added = await client.call_tool(
            "add_to_library", {"source": source, "result_id": "1342", "result": found.structured_content["results"][0]}
        )
        assert "Jane Austen" in added.content[0].text
    payload = json.loads(backend["requests"][-1].content)
    assert payload["result"] == selected


@pytest.mark.parametrize("result", [None, {}, {"title": "  "}, {"title": "Livre", "source": "autre"}])
async def test_f01_incomplete_result_is_explicitly_rejected(backend, result):
    with pytest.raises(RuntimeError):
        await server.add_to_library("gutenberg", "1342", result=result)
    assert not backend["requests"]


async def test_f02_library_set_clear_read_and_omission(backend):
    await server.update_library_item("livre", page_count=12, language="en")
    await server.update_library_item("livre", clear_page_count=True)
    async with server._client() as client:
        book = (await client.get("/api/v1/books/livre")).json()
    assert book["page_count"] is None
    assert book["language"] == "en"
    assert book["title"] == "Orgueil et Préjugés"


async def test_f02_device_set_clear_read_and_omission(backend):
    await server.update_device("liseuse", conversion_profile="tablet", name="Bureau")
    await server.update_device("liseuse", clear_conversion_profile=True)
    async with server._client() as client:
        device = (await client.get("/api/v1/devices/liseuse")).json()
    assert device["conversion_profile"] is None
    assert device["name"] == "Bureau"
    assert device["brand"] == "kindle"


@pytest.mark.parametrize("requested,expected", [("mobi", "epub"), ("azw3", "epub"), ("epub", "epub"), ("pdf", "pdf")])
async def test_f03_both_previews_use_core_format(backend, requested, expected):
    backend["target_format"] = expected
    plan = await server.plan_delivery("livre", "liseuse", format=requested)
    preview = await server.deliver_to_kindle("livre", "liseuse", format=requested)
    assert f"Format cible résolu: `{expected}`" in plan
    assert f"format cible: {expected}" in preview
    assert not any(req.method == "POST" for req in backend["requests"])


@pytest.mark.parametrize("confirm", [False, True])
@pytest.mark.parametrize("status", [401, 403, 404, 500])
async def test_f04_book_errors_stop_preview_and_delivery(backend, status, confirm):
    backend["book_status"] = status
    with pytest.raises(RuntimeError) as error:
        await server.deliver_to_kindle("livre", "liseuse", confirm=confirm)
    if status == 404:
        assert "ressource introuvable" in str(error.value).lower()
    assert not any(req.method == "POST" or req.url.path.endswith("/preview") for req in backend["requests"])


async def test_f02_clear_flags_exclude_required_fields_and_take_priority(backend):
    """Le schéma ne propose aucun effacement de titre, auteur, marque ou format par défaut."""
    tools = {tool.name: tool for tool in await server.mcp.list_tools()}
    for name, forbidden in [
        ("update_library_item", ["clear_title", "clear_author"]),
        ("update_device", ["clear_brand"]),
        ("update_profile", ["clear_default_format"]),
    ]:
        assert not set(forbidden) & tools[name].parameters["properties"].keys()
    await server.update_library_item("livre", page_count=12, clear_page_count=True)
    await server.update_device("liseuse", conversion_profile="tablet", clear_conversion_profile=True)
    assert backend["book"]["page_count"] is None
    assert backend["device"]["conversion_profile"] is None


async def test_f03_previews_do_not_reimplement_the_core_rule(backend):
    """Une réponse différente du cœur doit être affichée telle quelle."""
    backend["target_format"] = "pdf"
    assert "Format cible résolu: `pdf`" in await server.plan_delivery("livre", format="mobi")
    assert "format cible: pdf" in await server.deliver_to_kindle("livre", format="mobi")


async def test_f01_missing_optional_metadata_is_not_invented(backend):
    selected = {"source": "gutenberg", "result_id": "1342", "title": "Livre sans auteur connu"}
    backend["result"] = selected
    result = await server.add_to_library("gutenberg", "1342", result=selected)
    payload = json.loads(backend["requests"][-1].content)
    assert payload["result"] == selected
    assert "author" not in payload["result"]
    assert "author: non renseigné" in result
