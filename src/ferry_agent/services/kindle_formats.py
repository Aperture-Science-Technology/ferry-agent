"""Formats acceptes par Amazon Send-to-Kindle (garde tier A).

Amazon a retire definitivement le support des formats Kindle historiques
(.mobi, .azw, .azw3, .prc) le 20/12/2023. Toute demande legacy bascule
donc vers EPUB (FALLBACK_FORMAT), le format universel encore accepte.
"""

from __future__ import annotations

SUPPORTED_FORMATS: frozenset[str] = frozenset(
    {"epub", "pdf", "txt", "rtf", "html", "htm", "jpeg", "jpg", "gif", "png", "bmp"}
)

# Formats Kindle historiques : rejetes par Amazon depuis le 20/12/2023.
LEGACY_KINDLE_FORMATS: frozenset[str] = frozenset({"mobi", "azw", "azw3", "prc"})

FALLBACK_FORMAT = "epub"


def _normalize(fmt: str) -> str:
    return fmt.lower().strip().lstrip(".")


def is_supported(fmt: str) -> bool:
    return _normalize(fmt) in SUPPORTED_FORMATS


def requires_conversion(fmt: str) -> bool:
    """True si le format est un legacy Kindle (doit basculer vers EPUB)."""
    return _normalize(fmt) in LEGACY_KINDLE_FORMATS


def resolve_kindle_target(
    requested: str | None,
    default: str | None,
    original: str,
) -> str:
    """Resout le format exact a produire pour un envoi Send-to-Kindle.

    Normalise (minuscules, point optionnel retire), puis :
    - format Amazon-accepte → lui-meme ;
    - format legacy Kindle (mobi/azw/azw3/prc) → EPUB : Amazon a supprime
      le support Send-to-Kindle de ces formats le 20/12/2023 ;
    - format inconnu (ex. cbz, docx) → EPUB.
    """
    chosen = _normalize(requested or default or original)
    if chosen in SUPPORTED_FORMATS:
        return chosen
    # Legacy ou inconnu : bascule EPUB (fin de support Amazon 20/12/2023).
    return FALLBACK_FORMAT
