from ferry_agent.connectors import Result


class UploadConnector:
    """Connecteur pour les fichiers deja fournis par l'utilisateur.

    Non cherchable : les fichiers d'upload n'existent qu'une fois deposes.
    `fetch` n'a pas de sens ici (le fichier est deja disponible localement
    via l'endpoint d'upload, voir api/books.py) ; ce connecteur n'existe que
    pour etre epingle dans le registry et permettre un refetch en lecture
    seule si necessaire plus tard.
    """

    name = "upload"

    async def search(self, query: str) -> list[Result]:
        return []

    async def fetch(self, result_id: str) -> str:
        raise NotImplementedError("le connecteur upload ne supporte pas fetch(); utiliser l'endpoint d'upload")
