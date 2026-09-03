"""Connecteur Project Gutenberg.

Recherche via l'API Gutendex (https://gutendex.com/), un index tiers en
lecture seule du catalogue Gutenberg qui expose une recherche texte simple
sans authentification. Le telechargement se fait directement sur
gutenberg.org via l'URL canonique de l'EPUB (avec ou sans images).
"""

import logging
import tempfile
from pathlib import Path

import httpx

from ferry_agent.connectors import Result

logger = logging.getLogger(__name__)

GUTENDEX_URL = "https://gutendex.com/books/"
DOWNLOAD_URL_TEMPLATES = (
    "https://www.gutenberg.org/ebooks/{id}.epub3.images",
    "https://www.gutenberg.org/ebooks/{id}.epub.noimages",
)


class GutenbergConnector:
    name = "gutenberg"

    async def search(self, query: str) -> list[Result]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(GUTENDEX_URL, params={"search": query})
            resp.raise_for_status()
            data = resp.json()

        results = []
        for book in data.get("results", []):
            authors = ", ".join(a.get("name", "") for a in book.get("authors", []))
            results.append(
                Result(
                    source=self.name,
                    title=book.get("title", ""),
                    result_id=str(book["id"]),
                    author=authors,
                    format="epub",
                )
            )
        return results

    async def fetch(self, result_id: str) -> str:
        tmp_path = Path(tempfile.gettempdir()) / f"gutenberg_{result_id}.epub"
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for template in DOWNLOAD_URL_TEMPLATES:
                url = template.format(id=result_id)
                resp = await client.get(url)
                if resp.status_code == 200 and resp.content:
                    tmp_path.write_bytes(resp.content)
                    return str(tmp_path)
        raise RuntimeError(f"unable to download gutenberg book {result_id}")
