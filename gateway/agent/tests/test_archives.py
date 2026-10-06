from zipfile import ZipFile

import pytest


def test_zip_slip_entry_is_rejected(tmp_path):
    from ferry_gateway_agent.archives import ArchiveError, extract_zip_archive

    archive = tmp_path / "pack.zip"
    with ZipFile(archive, "w") as zipped:
        zipped.writestr("good.epub", b"ebook")
        zipped.writestr("../evil.epub", b"evil")
    destination = tmp_path / "output"
    with pytest.raises(ArchiveError):
        extract_zip_archive(archive, destination=destination, max_bytes=100, max_entries=10)
    assert not (tmp_path / "evil.epub").exists()
    assert not (destination / "good.epub").exists()


def test_zip_too_large_is_rejected(tmp_path):
    from ferry_gateway_agent.archives import ArchiveError, extract_zip_archive

    archive = tmp_path / "pack.zip"
    with ZipFile(archive, "w") as zipped:
        zipped.writestr("one.epub", b"a" * 6)
        zipped.writestr("two.epub", b"b" * 6)
    destination = tmp_path / "output"
    with pytest.raises(ArchiveError):
        extract_zip_archive(archive, destination=destination, max_bytes=10, max_entries=10)
    assert not list(destination.glob("*"))


def test_pick_largest_ebook_ignores_non_ebooks(tmp_path):
    from ferry_gateway_agent.archives import pick_largest_ebook

    files = [tmp_path / name for name in ("z.epub", "a.PDF", "extra.bin")]
    for path, size in zip(files, (10, 10, 100), strict=True):
        path.write_bytes(b"x" * size)
    assert pick_largest_ebook(files) == files[1]
    assert pick_largest_ebook([files[2]]) is None
