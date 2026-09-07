"""Presets de conversion par liseuse (W-27) + cache des derives.

Trois presets seulement en v1 : pas de reglage fin (marges/police libres)
pour eviter l'explosion combinatoire documentee. Chaque preset mappe vers
une liste d'arguments `ebook-convert`.

Le cache des derives vit sous `settings.temp_dir/conversion_cache/` et est
cle par `(library_item_id, preset, format_cible)` avec TTL.
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Any, Literal

from ferry_agent.config import get_settings

logger = logging.getLogger(__name__)

ConversionPreset = Literal["reader_6in", "reader_7in_plus", "tablet"]
PRESET_IDS: tuple[ConversionPreset, ...] = ("reader_6in", "reader_7in_plus", "tablet")

# Libelles non-tech (mirroirs des messages UI). Une phrase chacun.
PRESET_LABELS: dict[ConversionPreset, str] = {
    "reader_6in": "Petite liseuse (environ 6 pouces)",
    "reader_7in_plus": "Grande liseuse (7 pouces et plus)",
    "tablet": "Tablette",
}

# Arguments ebook-convert distincts par preset (tailles/mises en page
# differentes → fichiers derives distincts).
_PRESET_ARGS: dict[ConversionPreset, list[str]] = {
    "reader_6in": [
        "--base-font-size",
        "16",
        "--margin-top",
        "4",
        "--margin-bottom",
        "4",
        "--margin-left",
        "4",
        "--margin-right",
        "4",
        "--output-profile",
        "generic_eink",
    ],
    "reader_7in_plus": [
        "--base-font-size",
        "14",
        "--margin-top",
        "10",
        "--margin-bottom",
        "10",
        "--margin-left",
        "10",
        "--margin-right",
        "10",
        "--output-profile",
        "generic_eink_hd",
    ],
    "tablet": [
        "--base-font-size",
        "12",
        "--margin-top",
        "36",
        "--margin-bottom",
        "36",
        "--margin-left",
        "36",
        "--margin-right",
        "36",
        "--output-profile",
        "tablet",
        "--pdf-page-numbers",
    ],
}

_CACHE_SUBDIR = "conversion_cache"
_DEFAULT_CACHE_KEY = "default"


def resolve_preset_id(raw: Any) -> ConversionPreset | None:
    """Extrait l'id de preset depuis la colonne JSONB (ou une str API)."""
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw if raw in PRESET_IDS else None
    if isinstance(raw, dict):
        preset = raw.get("preset")
        if isinstance(preset, str) and preset in PRESET_IDS:
            return preset  # type: ignore[return-value]
    return None


def to_storage(preset: ConversionPreset | None) -> dict[str, str] | None:
    """Forme JSONB stockee en base."""
    if preset is None:
        return None
    return {"preset": preset}


def ebook_convert_args(preset: ConversionPreset | None) -> list[str]:
    if preset is None:
        return []
    return list(_PRESET_ARGS[preset])


def cache_root() -> Path:
    root = Path(get_settings().temp_dir) / _CACHE_SUBDIR
    root.mkdir(parents=True, exist_ok=True)
    return root


def _cache_key_preset(preset: ConversionPreset | None) -> str:
    return preset or _DEFAULT_CACHE_KEY


def cache_path(
    library_item_id: uuid.UUID,
    preset: ConversionPreset | None,
    target_format: str,
) -> Path:
    fmt = target_format.lower().lstrip(".")
    name = f"{library_item_id}_{_cache_key_preset(preset)}_{fmt}.{fmt}"
    return cache_root() / name


def is_cached_derivative(path: str | Path) -> bool:
    candidate = Path(path).resolve()
    try:
        candidate.relative_to(cache_root().resolve())
        return True
    except ValueError:
        return False


def _ttl_seconds() -> int:
    return int(get_settings().conversion_cache_ttl_seconds)


def get_cached(
    library_item_id: uuid.UUID,
    preset: ConversionPreset | None,
    target_format: str,
) -> Path | None:
    """Retourne le chemin cache s'il existe et n'a pas depasse le TTL."""
    path = cache_path(library_item_id, preset, target_format)
    if not path.is_file():
        return None
    age = time.time() - path.stat().st_mtime
    if age > _ttl_seconds():
        path.unlink(missing_ok=True)
        return None
    return path


def purge_conversion_cache(*, expired_only: bool = True) -> int:
    """Supprime les derives caches. Retourne le nombre de fichiers purges.

    Par defaut ne retire que les entrees hors TTL ; `expired_only=False`
    vide tout le repertoire de cache.
    """
    root = cache_root()
    removed = 0
    ttl = _ttl_seconds()
    now = time.time()
    for path in root.iterdir():
        if not path.is_file():
            continue
        if expired_only and (now - path.stat().st_mtime) <= ttl:
            continue
        path.unlink(missing_ok=True)
        removed += 1
    if removed:
        logger.info("conversion cache purge: %s fichier(s) retires", removed)
    return removed
