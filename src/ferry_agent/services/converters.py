"""Conversion de formats ebook.

EPUB->PDF utilise toujours PyMuPDF (fitz). EPUB->MOBI/AZW3 et toute
conversion vers EPUB utilisent `ebook-convert` (Calibre). Pas de fallback
silencieux vers un autre format : si Calibre est absent ou échoue, l'appelant
doit marquer la livraison en échec (cf. `services/delivery.py`).

W-27 : `_run_ebook_convert` accepte des arguments supplementaires issus du
profil de conversion du device.
"""

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from collections.abc import Sequence
from pathlib import Path

from ferry_agent.config import get_settings
from ferry_agent.services import conversion_profiles

logger = logging.getLogger(__name__)

MIN_OUTPUT_BYTES = 1024
EBOOK_CONVERT_TIMEOUT_SECONDS = 120
EBOOK_CONVERT_VERSION_TIMEOUT_SECONDS = 10

# Message actionnable exposé dans DeliveryJob.error (pas de jargon technique).
CONVERSION_FAILED_USER_MESSAGE = (
    "Impossible de convertir ce livre vers le format demandé. "
    "Réessayez plus tard ou choisissez un autre format."
)


def _default_temp_output(suffix: str) -> Path:
    """Chemin unique sous `settings.temp_dir` (cree si absent)."""
    settings = get_settings()
    temp_dir = Path(settings.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=str(temp_dir), suffix=suffix)
    os.close(fd)
    return Path(name)


def ebook_convert_available() -> bool:
    return shutil.which("ebook-convert") is not None


def ebook_convert_version() -> str | None:
    """Retourne la premiere ligne de `ebook-convert --version`, ou None."""
    if not ebook_convert_available():
        return None
    try:
        proc = subprocess.run(
            ["ebook-convert", "--version"],
            capture_output=True,
            text=True,
            timeout=EBOOK_CONVERT_VERSION_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    line = (proc.stdout or proc.stderr or "").strip().splitlines()
    return line[0].strip() if line else None


def calibre_status_line() -> str:
    version = ebook_convert_version()
    if version:
        return f"Calibre : OK ({version})"
    if ebook_convert_available():
        return "Calibre : OK"
    return "Calibre : indisponible"


def conversion_capacity() -> dict[str, bool | str | None]:
    """Etat verifiable (healthz) de la capacite de conversion Calibre."""
    available = ebook_convert_available()
    return {
        "ebook_convert_available": available,
        "ebook_convert_version": ebook_convert_version() if available else None,
    }


def _check_output(path: Path) -> None:
    if not path.exists() or path.stat().st_size < MIN_OUTPUT_BYTES:
        raise RuntimeError(f"conversion output invalid or too small: {path}")


def _epub_to_pdf_sync(epub_path: str, pdf_path: str) -> None:
    import fitz  # PyMuPDF

    src = fitz.open(epub_path)
    try:
        pdf_bytes = src.convert_to_pdf()
    finally:
        src.close()

    pdf_doc = fitz.open("pdf", pdf_bytes)
    try:
        pdf_doc.save(pdf_path)
    finally:
        pdf_doc.close()


async def epub_to_pdf(epub_path: str, pdf_path: str | None = None) -> str:
    src = Path(epub_path)
    out = Path(pdf_path) if pdf_path else src.with_suffix(".pdf")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _epub_to_pdf_sync, str(src), str(out))

    _check_output(out)
    return str(out)


async def _run_ebook_convert(
    src: str,
    dst: str,
    extra_args: Sequence[str] | None = None,
) -> None:
    cmd: list[str] = ["ebook-convert", src, dst]
    if extra_args:
        cmd.extend(extra_args)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=EBOOK_CONVERT_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise RuntimeError(f"ebook-convert timed out after {EBOOK_CONVERT_TIMEOUT_SECONDS}s") from None

    if proc.returncode != 0:
        raise RuntimeError(f"ebook-convert failed ({proc.returncode}): {stderr.decode(errors='replace')}")


async def epub_to_mobi(
    epub_path: str,
    mobi_path: str | None = None,
    extra_args: Sequence[str] | None = None,
) -> str:
    if not ebook_convert_available():
        raise RuntimeError("ebook-convert indisponible: conversion vers MOBI impossible")

    out = Path(mobi_path) if mobi_path else _default_temp_output(".mobi")
    if extra_args:
        await _run_ebook_convert(epub_path, str(out), extra_args=extra_args)
    else:
        await _run_ebook_convert(epub_path, str(out))
    _check_output(out)
    return str(out)


async def epub_to_azw3(
    epub_path: str,
    azw3_path: str | None = None,
    extra_args: Sequence[str] | None = None,
) -> str:
    if not ebook_convert_available():
        raise RuntimeError("ebook-convert indisponible: conversion vers AZW3 impossible")

    out = Path(azw3_path) if azw3_path else _default_temp_output(".azw3")
    if extra_args:
        await _run_ebook_convert(epub_path, str(out), extra_args=extra_args)
    else:
        await _run_ebook_convert(epub_path, str(out))
    _check_output(out)
    return str(out)


async def convert_to_epub(
    src_path: str,
    epub_path: str | None = None,
    extra_args: Sequence[str] | None = None,
) -> str:
    """Convertit un ebook (pdf/mobi/azw3...) en EPUB via `ebook-convert`.

    Pas de fallback PyMuPDF : `fitz` ne sait pas ecrire d'EPUB.
    """
    out = Path(epub_path) if epub_path else _default_temp_output(".epub")

    if not ebook_convert_available():
        raise RuntimeError("ebook-convert indisponible: conversion vers EPUB impossible")

    if extra_args:
        await _run_ebook_convert(src_path, str(out), extra_args=extra_args)
    else:
        await _run_ebook_convert(src_path, str(out))
    _check_output(out)
    return str(out)


async def convert_with_profile_cache(
    *,
    library_item_id: uuid.UUID,
    src_path: str,
    target_format: str,
    preset: conversion_profiles.ConversionPreset | None,
    convert_kind: str,
) -> tuple[str, bool]:
    """Convertit en passant par le cache (library_item_id, profil, format).

    Retourne `(chemin, from_cache)`.
    `convert_kind` : `to_epub` | `epub_to_mobi` | `epub_to_azw3`.
    """
    cached = conversion_profiles.get_cached(library_item_id, preset, target_format)
    if cached is not None:
        return str(cached), True

    extra_args = conversion_profiles.ebook_convert_args(preset)
    out = conversion_profiles.cache_path(library_item_id, preset, target_format)
    out.parent.mkdir(parents=True, exist_ok=True)

    if convert_kind == "to_epub":
        path = await convert_to_epub(src_path, str(out), extra_args=extra_args)
    elif convert_kind == "epub_to_mobi":
        path = await epub_to_mobi(src_path, str(out), extra_args=extra_args)
    elif convert_kind == "epub_to_azw3":
        path = await epub_to_azw3(src_path, str(out), extra_args=extra_args)
    else:
        raise ValueError(f"convert_kind inconnu: {convert_kind}")

    return path, False
