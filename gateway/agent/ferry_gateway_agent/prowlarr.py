import hashlib
import json
import re
import time
from collections import OrderedDict
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import parse_qsl, urlsplit

import httpx

BOOK_CATEGORIES = (7000, 7020)
EBOOK_EXTENSIONS = {"azw", "azw3", "epub", "mobi", "pdf"}
CACHE_TTL_SECONDS = 3600
CACHE_MAX_ENTRIES = 2048


class DownloadReferenceError(RuntimeError):
    """A local result can no longer be downloaded; never includes private data."""


def _release_identity(value: str) -> str:
    if not value.lower().startswith(("http://", "https://")):
        return value
    parsed = urlsplit(value)
    if parsed.scheme in {"http", "https"}:
        # Keep release selectors (including Prowlarr's `link`), but not keys,
        # credentials or fragments. Nested download URLs need the same treatment.
        selectors = sorted(
            (name.lower(), _release_identity(item))
            for name, item in parse_qsl(parsed.query, keep_blank_values=True)
            if not re.search(r"key|token|auth|password|secret|sig", name, re.IGNORECASE)
        )
        return json.dumps((parsed.hostname, parsed.port, parsed.path, selectors))
    return value


def _local_reference(raw: dict[str, Any]) -> str:
    identity = _release_identity(str(raw.get("guid") or raw.get("downloadUrl")))
    digest = hashlib.sha256(identity.encode()).hexdigest()
    indexer_id = str(raw.get("indexerId") or 0)
    if not indexer_id.isdecimal():
        indexer_id = "0"
    return f"ferry-gw:{indexer_id}:{digest}"


def _format_from_result(result: dict[str, Any]) -> str | None:
    for value in (result.get("title"), result.get("guid"), result.get("downloadUrl")):
        suffix = PurePosixPath(str(value or "").split("?", 1)[0]).suffix.lower().lstrip(".")
        if suffix in EBOOK_EXTENSIONS:
            return suffix

    text = " ".join(
        str(category.get("name", "")) for category in result.get("categories", []) if isinstance(category, dict)
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
        # Private URLs are returned only to the local fetch worker, never persisted.
        self._download_cache: OrderedDict[str, tuple[float, str]] = OrderedDict()

    def _prune_cache(self) -> None:
        cutoff = time.monotonic() - CACHE_TTL_SECONDS
        while self._download_cache:
            created, _ = next(iter(self._download_cache.values()))
            if created > cutoff and len(self._download_cache) <= CACHE_MAX_ENTRIES:
                break
            self._download_cache.popitem(last=False)

    async def resolve(self, reference: str, *, title: str) -> str:
        self._prune_cache()
        cached = self._download_cache.get(reference)
        if cached is not None:
            return cached[1]
        if title.strip():
            try:
                await self.search(title)
            except (httpx.HTTPError, ValueError, TypeError):
                raise DownloadReferenceError(
                    "Impossible de retrouver ce livre pour le moment. "
                    "Vérifiez votre source. Relancez la recherche avant de réessayer."
                ) from None
            cached = self._download_cache.get(reference)
            if cached is not None:
                return cached[1]
        raise DownloadReferenceError(
            "Ce livre n’est plus disponible dans les résultats de votre source. "
            "Relancez la recherche puis choisissez à nouveau le livre."
        )

    async def search(self, query: str) -> list[dict[str, Any]]:
        self._prune_cache()
        response = await self._client.get(
            f"{self.base_url}/api/v1/search",
            params={
                "query": query,
                "type": "search",
                "categories": list(BOOK_CATEGORIES),
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
            if not (magnet or guid or raw.get("downloadUrl")):
                continue
            result_id = str(magnet) if magnet else _local_reference(raw)
            if not magnet:
                download_url = raw.get("downloadUrl") or guid
                if isinstance(download_url, str) and download_url.startswith(("http://", "https://", "magnet:")):
                    self._download_cache[result_id] = (time.monotonic(), download_url)
                    self._download_cache.move_to_end(result_id)
                    self._prune_cache()
            mapped.append(
                {
                    "source": "prowlarr",
                    "title": str(raw.get("title") or "Untitled"),
                    "author": _author_from_result(raw) or "",
                    "format": _format_from_result(raw) or "epub",
                    "size_bytes": int(raw.get("size") or 0),
                    "result_id": str(result_id),
                    "magnet_url": magnet,
                    "download_url": None,
                    "indexer_id": raw.get("indexerId"),
                    "guid": result_id,
                    "seeders": raw.get("seeders"),
                    **{field: raw[field] for field in ("language", "isbn", "page_count") if field in raw},
                }
            )
        return mapped

    async def aclose(self) -> None:
        self._download_cache.clear()
        if self._owns_client:
            await self._client.aclose()
