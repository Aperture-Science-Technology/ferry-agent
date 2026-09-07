"""Validation allowlist et cache des couvertures (proxy serveur)."""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

from ferry_agent.config import get_settings

logger = logging.getLogger(__name__)

COVER_FETCH_TIMEOUT_SECONDS = 5.0
COVER_MAX_BYTES = 2 * 1024 * 1024
COVER_CACHE_TTL = timedelta(days=30)

# Hotes exacts ou suffixes de domaine autorises pour cover_url.
_COVER_HOST_SUFFIXES = ("gutenberg.org", "standardebooks.org")
_COVER_HOST_EXACT = frozenset({"covers.openlibrary.org"})

_IMAGE_CONTENT_TYPE_RE = re.compile(r"^image/(jpeg|jpg|png|gif|webp|svg\+xml)(?:\s*;.*)?$", re.I)
_EXT_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


def is_allowed_cover_host(hostname: str | None) -> bool:
    """True si l'hote est dans l'allowlist (sous-domaines inclus pour Gutenberg/SE)."""
    if not hostname:
        return False
    host = hostname.lower().rstrip(".")
    if host in _COVER_HOST_EXACT:
        return True
    for suffix in _COVER_HOST_SUFFIXES:
        if host == suffix or host.endswith("." + suffix):
            return True
    return False


def validate_cover_url(url: str | None) -> str | None:
    """Retourne l'URL si https + hote allowlist, sinon ``None`` (rejet silencieux)."""
    if not url or not isinstance(url, str):
        return None
    raw = url.strip()
    if not raw:
        return None
    try:
        parsed = urlparse(raw)
    except Exception:
        return None
    if parsed.scheme.lower() != "https":
        return None
    if parsed.username is not None or parsed.password is not None:
        return None
    if not parsed.hostname:
        return None
    # Refuser litteraux IP / crochets IPv6 : seuls des noms allowlistes.
    if re.fullmatch(r"[\d.]+", parsed.hostname) or ":" in parsed.hostname:
        return None
    if not is_allowed_cover_host(parsed.hostname):
        return None
    return raw


def _cache_dir() -> Path:
    settings = get_settings()
    path = Path(settings.temp_dir) / "covers"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _cache_stem(item_id: str, cover_url: str) -> str:
    digest = hashlib.sha256(cover_url.encode("utf-8")).hexdigest()[:16]
    return f"{item_id}_{digest}"


def _find_fresh_cache(stem: str) -> Path | None:
    directory = _cache_dir()
    cutoff = datetime.now(timezone.utc) - COVER_CACHE_TTL
    for candidate in directory.glob(f"{stem}.*"):
        if not candidate.is_file():
            continue
        mtime = datetime.fromtimestamp(candidate.stat().st_mtime, tz=timezone.utc)
        if mtime >= cutoff:
            return candidate
        candidate.unlink(missing_ok=True)
    return None


def _extension_for_content_type(content_type: str | None) -> str | None:
    if not content_type:
        return None
    mime = content_type.split(";", 1)[0].strip().lower()
    if not _IMAGE_CONTENT_TYPE_RE.match(content_type.strip()):
        return None
    return _EXT_BY_CONTENT_TYPE.get(mime)


async def fetch_cover_to_cache(item_id: str, cover_url: str) -> tuple[Path, str]:
    """Telecharge ``cover_url`` (deja validee) vers le cache temp_dir.

    Retourne ``(chemin, media_type)``. Leve ``ValueError`` si telechargement
    ou type invalide.
    """
    safe_url = validate_cover_url(cover_url)
    if safe_url is None:
        raise ValueError("cover_url non autorisee")

    stem = _cache_stem(item_id, safe_url)
    cached = _find_fresh_cache(stem)
    if cached is not None:
        media = _guess_media_type(cached.suffix)
        return cached, media

    async with httpx.AsyncClient(
        timeout=COVER_FETCH_TIMEOUT_SECONDS,
        follow_redirects=True,
        max_redirects=5,
    ) as client:
        async with client.stream("GET", safe_url) as response:
            response.raise_for_status()
            final_host = urlparse(str(response.url)).hostname
            if not is_allowed_cover_host(final_host):
                raise ValueError("redirection hors allowlist")
            content_type = response.headers.get("content-type", "")
            ext = _extension_for_content_type(content_type)
            if ext is None:
                raise ValueError("Content-Type image requis")
            media_type = content_type.split(";", 1)[0].strip().lower()
            if media_type == "image/jpg":
                media_type = "image/jpeg"

            buf = bytearray()
            async for chunk in response.aiter_bytes():
                buf.extend(chunk)
                if len(buf) > COVER_MAX_BYTES:
                    raise ValueError("couverture trop volumineuse")

    dest = _cache_dir() / f"{stem}{ext}"
    dest.write_bytes(bytes(buf))
    return dest, media_type


def _guess_media_type(suffix: str) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }.get(suffix.lower(), "application/octet-stream")
