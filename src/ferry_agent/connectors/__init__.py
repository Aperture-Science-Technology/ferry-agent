"""Interface commune des connecteurs de sources d'ebooks legales.

Note: le champ `result_id` est place juste apres `title` (et non en dernier)
car un dataclass Python ne peut pas faire suivre un champ sans defaut par des
champs avec defaut.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass
class Result:
    source: str  # "gutenberg" | "standard_ebooks" | "upload"
    title: str
    result_id: str  # identifiant stable pour fetch()
    author: str = ""
    format: str = "epub"
    size_bytes: int = 0
    cover_url: str | None = None
    language: str | None = None
    description: str | None = None
    page_count: int | None = None
    isbn: str | None = None


class Connector(Protocol):
    async def search(self, query: str) -> list[Result]: ...

    async def fetch(self, result_id: str) -> str:
        """Retourne le chemin d'un fichier temporaire local."""
        ...
