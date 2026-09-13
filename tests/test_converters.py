"""Tests du pipeline de conversion (`services/converters.py`).

- La detection Calibre (`ebook_convert_available` / `calibre_status_line`)
  est testee inconditionnellement : elle ne necessite pas Calibre installe,
  seulement `shutil.which`.
- La conversion EPUB->PDF reelle (PyMuPDF) est testee si le fixture
  `tests/fixtures/minimal.epub` est present ; sinon ce test est skip.
- EPUB->MOBI/AZW3 exige Calibre : sans binaire, les helpers levent
  RuntimeError (plus de fallback PDF silencieux, W-26).
"""

from pathlib import Path
import uuid

import pytest

from ferry_agent.services import converters

FIXTURES_DIR = Path(__file__).parent / "fixtures"
MINIMAL_EPUB = FIXTURES_DIR / "minimal.epub"
AZW3_MAGIC = b"PK\x03\x04"


def test_ebook_convert_available_returns_bool() -> None:
    assert isinstance(converters.ebook_convert_available(), bool)


def test_calibre_status_line_matches_detection() -> None:
    line = converters.calibre_status_line()
    if converters.ebook_convert_available():
        assert line.startswith("Calibre : OK")
    else:
        assert line == "Calibre : indisponible"


def test_conversion_capacity_shape() -> None:
    capacity = converters.conversion_capacity()
    assert set(capacity) == {"ebook_convert_available", "ebook_convert_version"}
    assert capacity["ebook_convert_available"] is converters.ebook_convert_available()
    if not capacity["ebook_convert_available"]:
        assert capacity["ebook_convert_version"] is None


@pytest.mark.skipif(not MINIMAL_EPUB.exists(), reason="pas de fixture epub disponible")
async def test_epub_to_pdf_real_conversion(tmp_path: Path) -> None:
    dest = tmp_path / "out.pdf"
    out_path = await converters.epub_to_pdf(str(MINIMAL_EPUB), str(dest))

    out = Path(out_path)
    assert out.exists()
    assert out.stat().st_size >= 1024
    assert out.suffix == ".pdf"


@pytest.mark.skipif(not MINIMAL_EPUB.exists(), reason="pas de fixture epub disponible")
async def test_epub_to_mobi_raises_without_calibre(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(converters.shutil, "which", lambda _name: None)
    dest = tmp_path / "out.mobi"

    with pytest.raises(RuntimeError, match="ebook-convert indisponible"):
        await converters.epub_to_mobi(str(MINIMAL_EPUB), str(dest))

    assert not dest.exists()
    assert list(tmp_path.glob("*.pdf")) == []


@pytest.mark.skipif(not MINIMAL_EPUB.exists(), reason="pas de fixture epub disponible")
async def test_epub_to_azw3_raises_without_calibre(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(converters.shutil, "which", lambda _name: None)
    dest = tmp_path / "out.azw3"

    with pytest.raises(RuntimeError, match="ebook-convert indisponible"):
        await converters.epub_to_azw3(str(MINIMAL_EPUB), str(dest))

    assert not dest.exists()
    assert list(tmp_path.glob("*.pdf")) == []


async def test_epub_to_azw3_mocked_ebook_convert_writes_azw3_magic(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Tier A azw3 : chemin de code correct + magic bytes AZW3 (mock Calibre)."""
    epub = tmp_path / "book.epub"
    epub.write_bytes(b"PK\x03\x04fake-epub-content-padded" + b"\x00" * 1024)
    dest = tmp_path / "out.azw3"

    monkeypatch.setattr(converters, "ebook_convert_available", lambda: True)

    async def fake_run_ebook_convert(src: str, dst: str) -> None:
        assert src == str(epub)
        # Contenu factice >= MIN_OUTPUT_BYTES avec magic AZW3 (PK\\x03\\x04).
        Path(dst).write_bytes(AZW3_MAGIC + b"\x00" * converters.MIN_OUTPUT_BYTES)

    monkeypatch.setattr(converters, "_run_ebook_convert", fake_run_ebook_convert)

    out_path = await converters.epub_to_azw3(str(epub), str(dest))

    out = Path(out_path)
    assert out == dest
    assert out.exists()
    assert out.read_bytes()[:4] == AZW3_MAGIC
    assert out.suffix == ".azw3"
    assert list(tmp_path.glob("*.pdf")) == []


async def test_materialize_target_format_same_format_returns_source(tmp_path: Path) -> None:
    src = tmp_path / "book.epub"
    src.write_bytes(b"PK" + b"x" * 100)
    path, from_cache = await converters.materialize_target_format(
        library_item_id=uuid.uuid4(),
        src_path=str(src),
        original_format="epub",
        target_format="epub",
        preset=None,
    )
    assert path == str(src)
    assert from_cache is False


async def test_materialize_target_format_epub_to_pdf(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    src = tmp_path / "book.epub"
    src.write_bytes(b"PK" + b"x" * 100)
    item_id = uuid.uuid4()
    seen: dict = {}

    async def fake_convert_with_profile_cache(**kwargs):
        seen.update(kwargs)
        out = tmp_path / f"out.{kwargs['target_format']}"
        out.write_bytes(b"%PDF" + b"\x00" * converters.MIN_OUTPUT_BYTES)
        return str(out), False

    monkeypatch.setattr(converters, "convert_with_profile_cache", fake_convert_with_profile_cache)

    path, from_cache = await converters.materialize_target_format(
        library_item_id=item_id,
        src_path=str(src),
        original_format="epub",
        target_format="pdf",
        preset=None,
    )

    assert seen["convert_kind"] == "epub_to_pdf"
    assert seen["target_format"] == "pdf"
    assert path.endswith(".pdf")
    assert from_cache is False


async def test_materialize_target_format_pdf_to_mobi_two_hop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    src = tmp_path / "book.pdf"
    src.write_bytes(b"%PDF" + b"x" * 100)
    calls: list[str] = []

    async def fake_convert_with_profile_cache(**kwargs):
        calls.append(kwargs["convert_kind"])
        out = tmp_path / f"out.{kwargs['target_format']}"
        out.write_bytes(b"x" * converters.MIN_OUTPUT_BYTES)
        return str(out), False

    monkeypatch.setattr(converters, "convert_with_profile_cache", fake_convert_with_profile_cache)

    path, _from_cache = await converters.materialize_target_format(
        library_item_id=uuid.uuid4(),
        src_path=str(src),
        original_format="pdf",
        target_format="mobi",
        preset=None,
    )

    assert calls == ["to_epub", "epub_to_mobi"]
    assert path.endswith(".mobi")

    with pytest.raises(RuntimeError):
        converters._check_output(tmp_path / "does_not_exist.pdf")


def test_check_output_raises_on_too_small_file(tmp_path: Path) -> None:
    tiny = tmp_path / "tiny.pdf"
    tiny.write_bytes(b"x")
    with pytest.raises(RuntimeError):
        converters._check_output(tiny)
