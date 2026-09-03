"""Tests du pipeline de conversion (`services/converters.py`).

- La detection Calibre (`ebook_convert_available` / `calibre_status_line`)
  est testee inconditionnellement : elle ne necessite pas Calibre installe,
  seulement `shutil.which`.
- La conversion EPUB->PDF reelle (PyMuPDF) est testee si le fixture
  `tests/fixtures/minimal.epub` est present ; sinon ce test est skip et
  seule la detection Calibre est verifiee.
- Les conversions EPUB->MOBI/AZW3 retombent sur PyMuPDF (export PDF) quand
  Calibre est indisponible, ce qui est le cas attendu dans cet
  environnement de test (pas de Calibre externe installe).
"""

import shutil
from pathlib import Path

import pytest

from ferry_agent.services import converters

FIXTURES_DIR = Path(__file__).parent / "fixtures"
MINIMAL_EPUB = FIXTURES_DIR / "minimal.epub"


def test_ebook_convert_available_returns_bool() -> None:
    assert isinstance(converters.ebook_convert_available(), bool)


def test_calibre_status_line_matches_detection() -> None:
    line = converters.calibre_status_line()
    if converters.ebook_convert_available():
        assert line == "Calibre : OK"
    else:
        assert line == "Calibre : indisponible (fallback PyMuPDF)"


@pytest.mark.skipif(not MINIMAL_EPUB.exists(), reason="pas de fixture epub disponible")
async def test_epub_to_pdf_real_conversion(tmp_path: Path) -> None:
    dest = tmp_path / "out.pdf"
    out_path = await converters.epub_to_pdf(str(MINIMAL_EPUB), str(dest))

    out = Path(out_path)
    assert out.exists()
    assert out.stat().st_size >= 1024
    assert out.suffix == ".pdf"


@pytest.mark.skipif(not MINIMAL_EPUB.exists(), reason="pas de fixture epub disponible")
async def test_epub_to_mobi_falls_back_without_calibre(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(converters.shutil, "which", lambda _name: None)
    dest = tmp_path / "out.mobi"

    out_path = await converters.epub_to_mobi(str(MINIMAL_EPUB), str(dest))

    out = Path(out_path)
    assert out.exists()
    assert out.stat().st_size >= 1024
    # Sans Calibre, le fallback produit un PDF (pas un vrai .mobi).
    assert out.suffix == ".pdf"


@pytest.mark.skipif(not MINIMAL_EPUB.exists(), reason="pas de fixture epub disponible")
async def test_epub_to_azw3_falls_back_without_calibre(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(converters.shutil, "which", lambda _name: None)
    dest = tmp_path / "out.azw3"

    out_path = await converters.epub_to_azw3(str(MINIMAL_EPUB), str(dest))

    out = Path(out_path)
    assert out.exists()
    assert out.stat().st_size >= 1024
    assert out.suffix == ".pdf"


def test_check_output_raises_on_missing_file(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError):
        converters._check_output(tmp_path / "does_not_exist.pdf")


def test_check_output_raises_on_too_small_file(tmp_path: Path) -> None:
    tiny = tmp_path / "tiny.pdf"
    tiny.write_bytes(b"x")
    with pytest.raises(RuntimeError):
        converters._check_output(tiny)
