"""Surveillance du dossier partage : fichiers stables -> upload bibliotheque.

Les fichiers places dans le dossier configure (defaut `/watch`) sont envoyes
vers `POST /api/v1/books/upload` avec la cle gateway, une fois leur taille
stable. Poll periodique (portable, sans API filesystem specifique).
"""

from __future__ import annotations

import asyncio
import logging
import mimetypes
import time
from pathlib import Path

import httpx

from .config import Settings

logger = logging.getLogger("ferry-gateway-agent")

_ACCEPTED_SUFFIXES = {".epub", ".pdf", ".mobi", ".azw3"}


class WatchFolderImporter:
    """Importe les ebooks deposes dans un dossier partage vers la plateforme."""

    def __init__(
        self,
        settings: Settings,
        *,
        platform: httpx.AsyncClient,
        gateway_headers: dict[str, str],
    ) -> None:
        self.settings = settings
        self.platform = platform
        self._gateway_headers = gateway_headers
        # path -> (size, mtime, unchanged_since)
        self._snapshots: dict[Path, tuple[int, float, float]] = {}
        self._inflight: set[Path] = set()

    def _watch_root(self) -> Path:
        root = self.settings.watch_path
        root.mkdir(parents=True, exist_ok=True)
        return root.resolve()

    def _candidate_files(self) -> list[Path]:
        root = self._watch_root()
        files: list[Path] = []
        for path in sorted(root.iterdir()):
            if not path.is_file() or path.name.startswith("."):
                continue
            if path.suffix.lower() not in _ACCEPTED_SUFFIXES:
                continue
            files.append(path)
        return files

    def _stable_files(self) -> list[Path]:
        """Fichiers dont taille+mtime sont inchanges depuis `watch_stable_seconds`."""
        now = time.time()
        delay = self.settings.watch_stable_seconds
        ready: list[Path] = []
        live: dict[Path, tuple[int, float, float]] = {}

        for path in self._candidate_files():
            try:
                stat = path.stat()
            except OSError:
                continue
            size, mtime = stat.st_size, stat.st_mtime
            previous = self._snapshots.get(path)
            if previous is not None and previous[0] == size and previous[1] == mtime:
                unchanged_since = previous[2]
                live[path] = (size, mtime, unchanged_since)
                if now - unchanged_since >= delay and path not in self._inflight:
                    ready.append(path)
            else:
                live[path] = (size, mtime, now)

        self._snapshots = live
        return ready

    async def upload_file(self, path: Path) -> None:
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        with path.open("rb") as handle:
            response = await self.platform.post(
                f"{self.settings.platform_url}/api/v1/books/upload",
                headers=self._gateway_headers,
                files={"file": (path.name, handle, content_type)},
            )
        if response.status_code >= 400:
            detail = response.text.strip() or "no detail"
            logger.warning(
                "Could not import %s (HTTP %s): %s",
                path.name,
                response.status_code,
                detail,
            )
            return
        try:
            path.unlink(missing_ok=True)
        except OSError as error:
            logger.warning(
                "Imported %s but could not remove local file: %s", path.name, error
            )
        else:
            logger.info("Imported %s into the library", path.name)
        self._snapshots.pop(path, None)

    async def poll_once(self) -> int:
        """Importe les fichiers stables. Retourne le nombre d'imports tentes."""
        ready = self._stable_files()
        for path in ready:
            self._inflight.add(path)
            try:
                await self.upload_file(path)
            except (httpx.HTTPError, OSError):
                logger.exception("Watch-folder import failed for %s", path.name)
            finally:
                self._inflight.discard(path)
        return len(ready)

    async def run(self) -> None:
        logger.info(
            "Shared folder ready at %s — drop a file there and it appears in the library",
            self._watch_root(),
        )
        while True:
            try:
                await self.poll_once()
            except Exception:
                logger.exception("Watch-folder cycle failed; will retry")
            await asyncio.sleep(self.settings.watch_poll_seconds)
