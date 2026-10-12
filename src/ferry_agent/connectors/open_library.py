"""Connecteur Open Library (catalogue public, telechargements via Internet Archive).

Recherche : https://openlibrary.org/search.json
Ne retient que les oeuvres avec un scan public reellement telechargeable
(`ia` present et `public_scan_b` vrai). En cas d'echec reseau / timeout /
reponse illisible, search() journalise un avertissement et renvoie [].
"""

from __future__ import annotations

import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import httpx

from ferry_agent.config import get_settings
from ferry_agent.connectors import Result
from ferry_agent.connectors.internet_archive import (
    pick_downloadable_file,
    prefer_download_url,
)

logger = logging.getLogger(__name__)

SEARCH_URL = "https://openlibrary.org/search.json"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
_SEARCH_TIMEOUT = 5.0
_FETCH_TIMEOUT = 30.0
_RESULT_ID_RE = re.compile(r"^(/works/|/books/)?OL\d+[WM]$")
_MAX_IA_ATTEMPTS = 5


def _validate_result_id(result_id: str) -> None:
    if not _RESULT_ID_RE.fullmatch(result_id):
        raise ValueError(f"result_id open_library invalide: {result_id!r}")


def _temp_path(suffix: str) -> Path:
    settings = get_settings()
    temp_dir = Path(settings.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=str(temp_dir), suffix=suffix)
    os.close(fd)
    return Path(name)


def is_publicly_downloadable(doc: dict[str, Any]) -> bool:
    """True si Open Library signale un scan IA public telechargeable."""
    ia = doc.get("ia")
    if not ia:
        return False
    return bool(doc.get("public_scan_b"))


def parse_search_docs(docs: list[dict[str, Any]]) -> list[Result]:
    """Transforme les documents search.json en Result (filtre hors-ligne)."""
    results: list[Result] = []
    seen: set[str] = set()
    for doc in docs:
        if not is_publicly_downloadable(doc):
            continue
        key = str(doc.get("key") or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        authors = doc.get("author_name") or []
        if isinstance(authors, str):
            author = authors
        else:
            author = ", ".join(str(a) for a in authors if a)
        cover_i = doc.get("cover_i")
        cover_url = (
            f"https://covers.openlibrary.org/b/id/{cover_i}-M.jpg" if cover_i else None
        )
        languages = doc.get("language") or []
        language = None
        if isinstance(languages, list) and languages:
            language = str(languages[0])
        elif isinstance(languages, str):
            language = languages
        results.append(
            Result(
                source="open_library",
                title=str(doc.get("title") or ""),
                result_id=key,
                author=author,
                format="epub",
                cover_url=cover_url,
                language=language,
            )
        )
    return results


class OpenLibraryConnector:
    name = "open_library"

    async def search(self, query: str) -> list[Result]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT, headers=headers) as client:
                resp = await client.get(
                    SEARCH_URL,
                    params={"q": query, "limit": 20},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("open_library search failed: %s: %s", type(exc).__name__, exc)
            return []

        docs = data.get("docs") if isinstance(data, dict) else None
        if not isinstance(docs, list):
            logger.warning("open_library search returned unreadable payload")
            return []
        return parse_search_docs([d for d in docs if isinstance(d, dict)])

    async def fetch(self, result_id: str) -> str:
        _validate_result_id(result_id)
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json,*/*"}
        tmp_path: Path | None = None
        try:
            async with httpx.AsyncClient(
                timeout=_FETCH_TIMEOUT, follow_redirects=True, headers=headers
            ) as client:
                ia_ids = await self._resolve_ia_ids(client, result_id)
                for ia_id in ia_ids[:_MAX_IA_ATTEMPTS]:
                    meta_resp = await client.get(f"https://archive.org/metadata/{ia_id}")
                    if meta_resp.status_code != 200:
                        continue
                    try:
                        meta = meta_resp.json()
                    except Exception:
                        continue
                    files = meta.get("files") if isinstance(meta, dict) else None
                    if not isinstance(files, list):
                        continue
                    picked = pick_downloadable_file(
                        [f for f in files if isinstance(f, dict)]
                    )
                    if picked is None:
                        continue
                    filename, fmt = picked
                    url = prefer_download_url(ia_id, filename)
                    file_resp = await client.get(url)
                    if file_resp.status_code != 200 or not file_resp.content:
                        continue
                    suffix = {"epub": ".epub", "pdf": ".pdf", "txt": ".txt"}.get(
                        fmt, ".bin"
                    )
                    tmp_path = _temp_path(suffix)
                    tmp_path.write_bytes(file_resp.content)
                    return str(tmp_path)
            raise RuntimeError(f"unable to download open_library book {result_id}")
        except Exception:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)
            raise

    async def _resolve_ia_ids(
        self, client: httpx.AsyncClient, result_id: str
    ) -> list[str]:
        resp = await client.get(
            SEARCH_URL,
            params={"q": f"key:{result_id}", "limit": 1},
        )
        resp.raise_for_status()
        data = resp.json()
        docs = data.get("docs") if isinstance(data, dict) else None
        if not isinstance(docs, list) or not docs:
            return []
        doc = docs[0]
        if not isinstance(doc, dict):
            return []
        ia = doc.get("ia") or []
        if isinstance(ia, str):
            return [ia] if ia else []
        return [str(i) for i in ia if i]
