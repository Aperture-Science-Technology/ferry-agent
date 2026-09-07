"""Connecteur Project Gutenberg.

Recherche via l'API Gutendex (https://gutendex.com/), un index tiers en
lecture seule du catalogue Gutenberg. Depuis certains datacenters gutendex
repond 403 ou timeout : on utilise un User-Agent navigateur, un timeout
court, un retry unique, puis un fallback HTML sur gutenberg.org. En cas
d'echec total, search() renvoie [] (jamais d'exception).
"""

import logging
import os
import re
import tempfile
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

from ferry_agent.config import get_settings
from ferry_agent.connectors import Result

logger = logging.getLogger(__name__)

GUTENDEX_URL = "https://gutendex.com/books/"
GUTENBERG_SEARCH_URL = "https://www.gutenberg.org/ebooks/search/"
DOWNLOAD_URL_TEMPLATES = (
    "https://www.gutenberg.org/ebooks/{id}.epub3.images",
    "https://www.gutenberg.org/ebooks/{id}.epub.noimages",
)
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
_SEARCH_TIMEOUT = 5.0
_BOOK_ID_RE = re.compile(r"/ebooks/(\d+)")
_RESULT_ID_RE = re.compile(r"^\d+$")


def _validate_result_id(result_id: str) -> None:
    if not _RESULT_ID_RE.fullmatch(result_id):
        raise ValueError(f"result_id gutenberg invalide: {result_id!r}")


def _temp_epub_path() -> Path:
    settings = get_settings()
    temp_dir = Path(settings.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=str(temp_dir), suffix=".epub")
    os.close(fd)
    return Path(name)


class GutenbergConnector:
    name = "gutenberg"

    async def search(self, query: str) -> list[Result]:
        try:
            results = await self._search_gutendex(query)
            if results:
                return results
        except Exception as exc:
            logger.warning("gutendex search failed: %s: %s", type(exc).__name__, exc)

        try:
            return await self._search_gutenberg_html(query)
        except Exception as exc:
            logger.warning("gutenberg html search failed: %s: %s", type(exc).__name__, exc)
            return []

    async def _search_gutendex(self, query: str) -> list[Result]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT, headers=headers) as client:
            resp: httpx.Response | None = None
            last_exc: Exception | None = None
            for _ in range(2):  # 1 essai + 1 retry
                try:
                    resp = await client.get(GUTENDEX_URL, params={"search": query})
                    break
                except Exception as exc:
                    last_exc = exc
            if resp is None:
                raise last_exc or RuntimeError("gutendex unreachable")
            if resp.status_code == 403:
                logger.warning("gutendex returned 403")
                return []
            resp.raise_for_status()
            data = resp.json()

        results = []
        for book in data.get("results", []):
            authors = ", ".join(a.get("name", "") for a in book.get("authors", []))
            formats = book.get("formats", {})
            languages = book.get("languages") or []
            results.append(
                Result(
                    source=self.name,
                    title=book.get("title", ""),
                    result_id=str(book["id"]),
                    author=authors,
                    format="epub",
                    cover_url=formats.get("image/jpeg"),
                    language=languages[0] if languages else None,
                )
            )
        return results

    async def _search_gutenberg_html(self, query: str) -> list[Result]:
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html,*/*"}
        async with httpx.AsyncClient(
            timeout=_SEARCH_TIMEOUT, follow_redirects=True, headers=headers
        ) as client:
            resp = await client.get(GUTENBERG_SEARCH_URL, params={"query": query})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.content, "html.parser")
        results: list[Result] = []
        seen: set[str] = set()
        for item in soup.select("li.booklink"):
            link = item.select_one("a.link")
            if link is None or not link.get("href"):
                continue
            match = _BOOK_ID_RE.search(link["href"])
            if not match:
                continue
            book_id = match.group(1)
            if book_id in seen:
                continue
            seen.add(book_id)
            title_el = item.select_one(".title")
            author_el = item.select_one(".subtitle")
            results.append(
                Result(
                    source=self.name,
                    title=title_el.get_text(strip=True) if title_el else "",
                    result_id=book_id,
                    author=author_el.get_text(strip=True) if author_el else "",
                    format="epub",
                )
            )
        return results

    async def fetch(self, result_id: str) -> str:
        _validate_result_id(result_id)
        tmp_path = _temp_epub_path()
        headers = {"User-Agent": USER_AGENT}
        try:
            async with httpx.AsyncClient(
                timeout=30, follow_redirects=True, headers=headers
            ) as client:
                for template in DOWNLOAD_URL_TEMPLATES:
                    url = template.format(id=result_id)
                    resp = await client.get(url)
                    if resp.status_code == 200 and resp.content:
                        tmp_path.write_bytes(resp.content)
                        return str(tmp_path)
            raise RuntimeError(f"unable to download gutenberg book {result_id}")
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise
