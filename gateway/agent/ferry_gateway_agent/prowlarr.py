import re
from pathlib import PurePosixPath
from typing import Any

import httpx

BOOK_CATEGORIES = (7000, 7020)
EBOOK_EXTENSIONS = {"azw", "azw3", "epub", "mobi", "pdf"}


def _format_from_result(result: dict[str, Any]) -> str | None:
    for value in (result.get("title"), result.get("guid"), result.get("downloadUrl")):
        suffix = PurePosixPath(str(value or "").split("?", 1)[0]).suffix.lower().lstrip(".")
        if suffix in EBOOK_EXTENSIONS:
            return suffix

    text = " ".join(
        str(category.get("name", ""))
        for category in result.get("categories", [])
        if isinstance(category, dict)
    ).lower()
    for extension in EBOOK_EXTENSIONS:
        if re.search(rf"\b{re.escape(extension)}\b", text):
            return extension
    return None


def _author_from_result(result: dict[str, Any]) -> str | None:
    author = result.get("author")
    if author:
        return str(author)
    return None


class ProwlarrClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=30)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def search(self, query: str) -> list[dict[str, Any]]:
        response = await self._client.get(
            f"{self.base_url}/api/v1/search",
            params={
                "query": query,
                "type": "search",
                "categories": ",".join(map(str, BOOK_CATEGORIES)),
            },
            headers={"X-Api-Key": self.api_key},
        )
        response.raise_for_status()

        mapped: list[dict[str, Any]] = []
        for raw in response.json():
            if not isinstance(raw, dict):
                continue
            magnet = raw.get("magnetUrl")
            guid = raw.get("guid")
            result_id = magnet or guid
            if not result_id:
                continue
            mapped.append(
                {
                    "source": "prowlarr",
                    "title": str(raw.get("title") or "Untitled"),
                    "author": _author_from_result(raw) or "",
                    "format": _format_from_result(raw) or "epub",
                    "size_bytes": int(raw.get("size") or 0),
                    "result_id": str(result_id),
                    "magnet_url": magnet,
                    "indexer_id": raw.get("indexerId"),
                    "guid": guid,
                    "seeders": raw.get("seeders"),
                }
            )
        return mapped

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
