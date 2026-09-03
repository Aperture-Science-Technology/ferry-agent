"""Conversion de formats ebook.

EPUB->PDF utilise toujours PyMuPDF (fitz). EPUB->MOBI/AZW3 utilise
`ebook-convert` (Calibre) quand disponible, sinon retombe sur un export PDF
via PyMuPDF (Calibre est optionnel et detecte au demarrage, cf. main.py).
"""

import asyncio
import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

MIN_OUTPUT_BYTES = 1024
EBOOK_CONVERT_TIMEOUT_SECONDS = 120


def ebook_convert_available() -> bool:
    return shutil.which("ebook-convert") is not None


def calibre_status_line() -> str:
    return "Calibre : OK" if ebook_convert_available() else "Calibre : indisponible (fallback PyMuPDF)"


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


async def _run_ebook_convert(src: str, dst: str) -> None:
    proc = await asyncio.create_subprocess_exec(
        "ebook-convert",
        src,
        dst,
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


async def epub_to_mobi(epub_path: str, mobi_path: str | None = None) -> str:
    out = Path(mobi_path) if mobi_path else Path(epub_path).with_suffix(".mobi")

    if ebook_convert_available():
        await _run_ebook_convert(epub_path, str(out))
        _check_output(out)
        return str(out)

    logger.warning("ebook-convert indisponible: fallback PyMuPDF (export PDF a la place du MOBI demande)")
    return await epub_to_pdf(epub_path, str(out.with_suffix(".pdf")))


async def epub_to_azw3(epub_path: str, azw3_path: str | None = None) -> str:
    out = Path(azw3_path) if azw3_path else Path(epub_path).with_suffix(".azw3")

    if ebook_convert_available():
        await _run_ebook_convert(epub_path, str(out))
        _check_output(out)
        return str(out)

    logger.warning("ebook-convert indisponible: fallback PyMuPDF (export PDF a la place de l'AZW3 demande)")
    return await epub_to_pdf(epub_path, str(out.with_suffix(".pdf")))


async def convert_to_epub(src_path: str, epub_path: str | None = None) -> str:
    """Convertit un ebook (pdf/mobi/azw3...) en EPUB via `ebook-convert`.

    Pas de fallback PyMuPDF ici : `fitz` sait lire/exporter en PDF mais pas
    ecrire d'EPUB, contrairement a `epub_to_mobi`/`epub_to_azw3` qui partent
    toujours d'un EPUB source.
    """
    out = Path(epub_path) if epub_path else Path(src_path).with_suffix(".epub")

    if not ebook_convert_available():
        raise RuntimeError("ebook-convert indisponible: conversion vers EPUB impossible")

    await _run_ebook_convert(src_path, str(out))
    _check_output(out)
    return str(out)
