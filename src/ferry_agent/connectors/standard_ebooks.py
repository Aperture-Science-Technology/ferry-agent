"""Connecteur Standard Ebooks via la recherche HTML publique.

L'OPDS (https://standardebooks.org/opds) exige une authentification (401)
et les anciens chemins /opds/search ou /feeds/opds/search renvoient 404.
La recherche publique valide est https://standardebooks.org/ebooks?query=...
(HTML schema.org). Le telechargement EPUB utilise le lien
.../downloads/<slug>.epub?source=download.
"""

import logging
import tempfile
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

from ferry_agent.connectors import Result

logger = logging.getLogger(__name__)

SEARCH_URL = "https://standardebooks.org/ebooks"
BASE_URL = "https://standardebooks.org"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def _slug_from_path(path: str) -> str:
    """Normalise un chemin /ebooks/... en slug relatif."""
    path = path.strip()
    if path.startswith("http"):
        path = path.split("standardebooks.org", 1)[-1]
    if not path.startswith("/"):
        path = "/" + path
    return path.rstrip("/")


def _epub_download_url(slug: str) -> str:
    """Construit l'URL de telechargement EPUB a partir du slug livre."""
    slug = _slug_from_path(slug)
    filename = slug.removeprefix("/ebooks/").replace("/", "_") + ".epub"
    return f"{BASE_URL}{slug}/downloads/{filename}?source=download"


class StandardEbooksConnector:
    name = "standard_ebooks"

    async def search(self, query: str) -> list[Result]:
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html,*/*"}
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=headers) as client:
            resp = await client.get(SEARCH_URL, params={"query": query})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.content, "html.parser")
        results: list[Result] = []
        seen: set[str] = set()

        for item in soup.select("ol.ebooks-list li[typeof='schema:Book']"):
            slug = item.get("about") or ""
            if not slug:
                link = item.select_one("a[href^='/ebooks/']")
                slug = link["href"] if link and link.get("href") else ""
            slug = _slug_from_path(slug)
            if not slug.startswith("/ebooks/") or slug in seen:
                continue
            seen.add(slug)

            title_el = item.select_one("p:not(.author) a[property='schema:name'], p:not(.author) a")
            if title_el is None:
                title_el = item.select_one("[property='schema:name']")
            title = title_el.get_text(strip=True) if title_el else ""

            author_el = item.select_one("p.author a, [property='schema:author']")
            author = author_el.get_text(strip=True) if author_el else ""

            # La couverture est servie par la page de resultats (schema:image sur
            # l'<img> de la vignette) ; la description n'y figure pas (uniquement
            # sur la page detail du livre), donc elle reste a None ici.
            cover_el = item.select_one("[property='schema:image']")
            cover_src = cover_el.get("src") if cover_el else None
            if not cover_src:
                cover_url = None
            elif cover_src.startswith("http"):
                cover_url = cover_src
            else:
                cover_url = f"{BASE_URL}{cover_src}"

            results.append(
                Result(
                    source=self.name,
                    title=title,
                    result_id=slug,
                    author=author,
                    format="epub",
                    cover_url=cover_url,
                )
            )
        return results

    async def fetch(self, result_id: str) -> str:
        slug = _slug_from_path(result_id)
        url = _epub_download_url(slug)
        filename = slug.removeprefix("/ebooks/").replace("/", "_") + ".epub"
        tmp_path = Path(tempfile.gettempdir()) / f"standardebooks_{filename}"

        headers = {"User-Agent": USER_AGENT, "Accept": "application/epub+zip,*/*"}
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            if not resp.content.startswith(b"PK"):
                raise RuntimeError(f"reponse non-epub pour {slug}")
            tmp_path.write_bytes(resp.content)
        return str(tmp_path)
