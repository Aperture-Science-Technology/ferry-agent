"""Connecteur Internet Archive (textes du domaine public librement telechargeables).

Recherche : https://archive.org/advancedsearch.php
Metadonnees : https://archive.org/metadata/{id}
Exclut le pret controle (lending / inlibrary). Ne conserve que les items
textuels a licence explicitement libre, avec un fichier epub, pdf ou
_djvu.txt present. En cas d'echec reseau / timeout / reponse illisible,
search() journalise un avertissement et renvoie [].
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx

from ferry_agent.config import get_settings
from ferry_agent.connectors import Result

logger = logging.getLogger(__name__)

SEARCH_URL = "https://archive.org/advancedsearch.php"
METADATA_URL = "https://archive.org/metadata/{identifier}"
DOWNLOAD_URL = "https://archive.org/download/{identifier}/{filename}"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
# advancedsearch.php mesure depuis le VPS de prod : 8,79 s puis 6,81 s
# (2026-10). Un plafond a 5 s rate systematiquement ; 15 s laisse une
# marge au-dessus du pire cas observe (httpx par requete).
_SEARCH_TIMEOUT = 15.0
# Budget interne total sous le plafond agrege (15 s / connecteur) :
# advancedsearch consomme deja ~7-9 s ; les metadonnees doivent tenir
# dans le reste. 12 s laisse ~3 s de marge avant l'abandon cote library.
_SEARCH_OVERALL_BUDGET = 12.0
# Metadonnees en parallele : le temps total ~ max(latences), pas la somme.
# Borne pour ne pas marteler archive.org.
_METADATA_CONCURRENCY = 4
_FETCH_TIMEOUT = 30.0
_RESULT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
_MAX_METADATA_CHECKS = 8

# Marqueurs de licence libre / domaine public (licenceurl ou rights).
_FREE_LICENSE_MARKERS = (
    "publicdomain",
    "public domain",
    "creativecommons.org/publicdomain",
    "cc0",
    "cc-zero",
    "/licenses/by/",
    "/licenses/by-sa/",
)

# Collections / drapeaux typiques du pret controle (lending library).
_LENDING_COLLECTIONS = frozenset(
    {
        "inlibrary",
        "printdisabled",
        "browserlending",
        "lendinglibrary",
    }
)

# Formats telechargeables acceptes, par preference (suffixe ou format IA).
_FORMAT_PREFERENCES: tuple[tuple[str, tuple[str, ...], tuple[str, ...]], ...] = (
    ("epub", (".epub",), ("EPUB",)),
    ("pdf", (".pdf",), ("Text PDF", "PDF", "Acrobat PDF")),
    ("txt", ("_djvu.txt",), ("DjVuTXT",)),
)


def _validate_result_id(result_id: str) -> None:
    if not _RESULT_ID_RE.fullmatch(result_id):
        raise ValueError(f"result_id internet_archive invalide: {result_id!r}")


def _temp_path(suffix: str) -> Path:
    settings = get_settings()
    temp_dir = Path(settings.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=str(temp_dir), suffix=suffix)
    os.close(fd)
    return Path(name)


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    return [str(value)]


def license_is_free(doc_or_meta: dict[str, Any]) -> bool:
    """True si licenceurl / rights indique clairement un contenu libre."""
    licenseurl = " ".join(_as_str_list(doc_or_meta.get("licenseurl"))).lower()
    rights = " ".join(_as_str_list(doc_or_meta.get("rights"))).lower()
    blob = f"{licenseurl} {rights}"
    return any(marker in blob for marker in _FREE_LICENSE_MARKERS)


def is_lending_restricted(doc_or_meta: dict[str, Any]) -> bool:
    """True pour le pret controle (lending library / acces restreint)."""
    restricted = doc_or_meta.get("access-restricted-item")
    if restricted is True or str(restricted).lower() in {"true", "1", "yes"}:
        return True
    collections = {c.lower() for c in _as_str_list(doc_or_meta.get("collection"))}
    return bool(collections & _LENDING_COLLECTIONS)


def pick_downloadable_file(
    files: list[dict[str, Any]],
) -> tuple[str, str] | None:
    """Retourne (filename, format) pour epub / pdf / _djvu.txt, sinon None."""
    for fmt, suffixes, _format_names in _FORMAT_PREFERENCES:
        for entry in files:
            name = str(entry.get("name") or "")
            if not name:
                continue
            if any(name.endswith(suffix) for suffix in suffixes):
                return name, fmt
    return None


def prefer_download_url(identifier: str, filename: str) -> str:
    return DOWNLOAD_URL.format(identifier=identifier, filename=filename)


def build_search_query(user_query: str) -> str:
    """Requete advancedsearch : textes + licence libre, hors lending.

    Une clause ``licenseurl`` avec trop de wildcards OR (publicdomain, cc0,
    creativecommons.org/..., licenses/by, by-sa) declenche un
    ``BACKEND_ERROR`` Elasticsearch cote archive.org (constate 2026-10,
    reponse JSON ``error`` sans ``response.docs``). On restreint a
    publicdomain/cc0 + rights ; ``license_is_free`` / ``parse_search_docs``
    affinent ensuite cote client (y compris CC-BY si un hit arrive).
    """
    safe = " ".join(user_query.split())
    license_clause = (
        "(licenseurl:(*publicdomain* OR *cc0*) "
        'OR rights:("Public domain*" OR "public domain*"))'
    )
    return (
        f"mediatype:texts AND ({safe}) AND {license_clause} "
        "AND NOT collection:(inlibrary OR printdisabled OR browserlending)"
    )


def parse_search_docs(docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filtre hors-ligne les docs de recherche (avant verification fichiers)."""
    kept: list[dict[str, Any]] = []
    for doc in docs:
        if str(doc.get("mediatype") or "texts") != "texts":
            continue
        if is_lending_restricted(doc):
            continue
        if not license_is_free(doc):
            continue
        identifier = str(doc.get("identifier") or "").strip()
        if not identifier:
            continue
        kept.append(doc)
    return kept


def result_from_metadata(
    identifier: str,
    meta_payload: dict[str, Any],
    *,
    title_hint: str = "",
    creator_hint: str = "",
) -> Result | None:
    """Construit un Result si metadonnees = texte libre telechargeable."""
    metadata = meta_payload.get("metadata")
    if not isinstance(metadata, dict):
        return None
    if str(metadata.get("mediatype") or "") != "texts":
        return None
    if is_lending_restricted(metadata):
        return None
    if not license_is_free(metadata):
        return None
    files = meta_payload.get("files")
    if not isinstance(files, list):
        return None
    picked = pick_downloadable_file([f for f in files if isinstance(f, dict)])
    if picked is None:
        return None
    _filename, fmt = picked
    title = str(metadata.get("title") or title_hint or "")
    creators = _as_str_list(metadata.get("creator")) or _as_str_list(creator_hint)
    return Result(
        source="internet_archive",
        title=title,
        result_id=identifier,
        author=", ".join(creators),
        format=fmt,
    )


class InternetArchiveConnector:
    name = "internet_archive"

    async def search(self, query: str) -> list[Result]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        deadline = time.monotonic() + _SEARCH_OVERALL_BUDGET
        search_timeout = min(_SEARCH_TIMEOUT, max(0.1, deadline - time.monotonic()))
        try:
            async with httpx.AsyncClient(timeout=search_timeout, headers=headers) as client:
                resp = await client.get(
                    SEARCH_URL,
                    params={
                        "q": build_search_query(query),
                        "fl[]": [
                            "identifier",
                            "title",
                            "creator",
                            "licenseurl",
                            "rights",
                            "collection",
                            "mediatype",
                            "access-restricted-item",
                        ],
                        "rows": 20,
                        "page": 1,
                        "output": "json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning(
                "internet_archive search failed: %s: %s", type(exc).__name__, exc
            )
            return []

        response = data.get("response") if isinstance(data, dict) else None
        docs = response.get("docs") if isinstance(response, dict) else None
        if not isinstance(docs, list):
            api_error = data.get("error") if isinstance(data, dict) else None
            if api_error:
                logger.warning("internet_archive search API error: %s", api_error)
            else:
                logger.warning("internet_archive search returned unreadable payload")
            return []

        candidates = parse_search_docs([d for d in docs if isinstance(d, dict)])[
            :_MAX_METADATA_CHECKS
        ]
        if not candidates or time.monotonic() >= deadline:
            return []

        slots: list[Result | None] = [None] * len(candidates)
        sem = asyncio.Semaphore(_METADATA_CONCURRENCY)

        async def fetch_metadata(
            index: int, doc: dict[str, Any], client: httpx.AsyncClient
        ) -> None:
            async with sem:
                if time.monotonic() >= deadline:
                    return
                identifier = str(doc["identifier"])
                try:
                    meta_resp = await client.get(
                        METADATA_URL.format(identifier=identifier)
                    )
                    if meta_resp.status_code != 200:
                        return
                    meta_payload = meta_resp.json()
                except Exception as exc:
                    logger.warning(
                        "internet_archive metadata failed: %s: %s",
                        type(exc).__name__,
                        exc,
                    )
                    return
                if not isinstance(meta_payload, dict):
                    return
                creators = doc.get("creator")
                creator_hint = (
                    ", ".join(_as_str_list(creators)) if creators is not None else ""
                )
                result = result_from_metadata(
                    identifier,
                    meta_payload,
                    title_hint=str(doc.get("title") or ""),
                    creator_hint=creator_hint,
                )
                if result is not None:
                    slots[index] = result

        try:
            remaining = max(0.1, deadline - time.monotonic())
            meta_timeout = min(_SEARCH_TIMEOUT, remaining)
            async with httpx.AsyncClient(timeout=meta_timeout, headers=headers) as client:
                tasks = [
                    asyncio.create_task(fetch_metadata(i, doc, client))
                    for i, doc in enumerate(candidates)
                ]
                done, pending = await asyncio.wait(
                    tasks, timeout=max(0.0, deadline - time.monotonic())
                )
                if pending:
                    for task in pending:
                        task.cancel()
                    await asyncio.gather(*pending, return_exceptions=True)
                    kept = sum(1 for slot in slots if slot is not None)
                    logger.warning(
                        "internet_archive metadata sweep stopped: overall "
                        "budget %.0fs exhausted (%d result(s) kept)",
                        _SEARCH_OVERALL_BUDGET,
                        kept,
                    )
                # Surface exceptions from completed tasks (already logged inside).
                for task in done:
                    exc = task.exception()
                    if exc is not None and not isinstance(exc, asyncio.CancelledError):
                        logger.warning(
                            "internet_archive metadata task failed: %s: %s",
                            type(exc).__name__,
                            exc,
                        )
        except Exception as exc:
            logger.warning(
                "internet_archive metadata sweep failed: %s: %s",
                type(exc).__name__,
                exc,
            )
            return [slot for slot in slots if slot is not None]
        return [slot for slot in slots if slot is not None]

    async def fetch(self, result_id: str) -> str:
        _validate_result_id(result_id)
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json,*/*"}
        tmp_path: Path | None = None
        try:
            async with httpx.AsyncClient(
                timeout=_FETCH_TIMEOUT, follow_redirects=True, headers=headers
            ) as client:
                meta_resp = await client.get(
                    METADATA_URL.format(identifier=result_id)
                )
                meta_resp.raise_for_status()
                meta_payload = meta_resp.json()
                if not isinstance(meta_payload, dict):
                    raise RuntimeError("internet_archive metadata unreadable")
                metadata = meta_payload.get("metadata")
                if not isinstance(metadata, dict):
                    raise RuntimeError("internet_archive metadata missing")
                if is_lending_restricted(metadata) or not license_is_free(metadata):
                    raise RuntimeError("internet_archive item not freely downloadable")
                files = meta_payload.get("files")
                if not isinstance(files, list):
                    raise RuntimeError("internet_archive files missing")
                picked = pick_downloadable_file(
                    [f for f in files if isinstance(f, dict)]
                )
                if picked is None:
                    raise RuntimeError("internet_archive has no allowed format")
                filename, fmt = picked
                url = prefer_download_url(result_id, filename)
                file_resp = await client.get(url)
                file_resp.raise_for_status()
                if not file_resp.content:
                    raise RuntimeError("internet_archive empty download")
                suffix = {"epub": ".epub", "pdf": ".pdf", "txt": ".txt"}.get(fmt, ".bin")
                tmp_path = _temp_path(suffix)
                tmp_path.write_bytes(file_resp.content)
                return str(tmp_path)
        except Exception:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)
            raise
