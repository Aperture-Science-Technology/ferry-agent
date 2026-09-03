"""Connecteur Standard Ebooks via son flux OPDS public.

https://standardebooks.org/opds fournit un catalogue au format
Atom/OPDS. La recherche utilise le flux OPDS de recherche
(https://standardebooks.org/opds/search?query=...), parse avec
BeautifulSoup (parser xml, via lxml). Le lien d'acquisition EPUB de chaque
entree est utilise tel quel comme `result_id` : fetch() se contente de le
televerser.
"""

import logging
import tempfile
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

from ferry_agent.connectors import Result

logger = logging.getLogger(__name__)

OPDS_SEARCH_URL = "https://standardebooks.org/opds/search"
EPUB_MIME = "application/epub+zip"


class StandardEbooksConnector:
    name = "standard_ebooks"

    async def search(self, query: str) -> list[Result]:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(OPDS_SEARCH_URL, params={"query": query})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.content, "xml")
        results = []
        for entry in soup.find_all("entry"):
            epub_link = entry.find("link", attrs={"type": EPUB_MIME})
            if epub_link is None or not epub_link.get("href"):
                continue

            title = entry.find("title")
            author_tag = entry.find("author")
            author_name = ""
            if author_tag is not None:
                name_tag = author_tag.find("name")
                author_name = name_tag.get_text(strip=True) if name_tag else ""

            results.append(
                Result(
                    source=self.name,
                    title=title.get_text(strip=True) if title else "",
                    result_id=epub_link["href"],
                    author=author_name,
                    format="epub",
                )
            )
        return results

    async def fetch(self, result_id: str) -> str:
        url = result_id
        if url.startswith("/"):
            url = f"https://standardebooks.org{url}"

        filename = url.rstrip("/").split("/")[-1] or "book.epub"
        if not filename.endswith(".epub"):
            filename += ".epub"
        tmp_path = Path(tempfile.gettempdir()) / f"standardebooks_{filename}"

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            tmp_path.write_bytes(resp.content)
        return str(tmp_path)
