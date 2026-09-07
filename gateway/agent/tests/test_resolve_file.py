"""Bounded download-path resolution for Transmission file lists."""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from agent_testkit import make_agent, make_settings


def _agent(state_path: Path, download_root: Path):
    settings = make_settings(
        state_path=state_path,
        download_path=download_root,
        gateway_id="gw-1",
        gateway_key="gw-key",
    )
    return make_agent(settings=settings)


def test_path_traversal_outside_download_path_is_ignored(
    state_path: Path,
    download_root: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    agent = _agent(state_path, download_root)
    outside = download_root.parent / "etc"
    outside.mkdir()
    (outside / "passwd").write_bytes(b"root:x:0:0")

    torrent = {
        "downloadDir": str(download_root),
        "files": [
            {
                "name": "../../etc/passwd",
                "length": 10,
                "bytesCompleted": 10,
            }
        ],
    }

    with caplog.at_level(logging.WARNING), pytest.raises(
        FileNotFoundError,
        match="no completed readable file",
    ):
        agent._resolve_downloaded_file(torrent)

    assert any("Ignoring file outside DOWNLOAD_PATH" in r.message for r in caplog.records)


def test_incomplete_file_is_ignored(
    state_path: Path,
    download_root: Path,
) -> None:
    agent = _agent(state_path, download_root)
    target = download_root / "book.epub"
    target.write_bytes(b"partial")

    torrent = {
        "downloadDir": str(download_root),
        "files": [
            {
                "name": "book.epub",
                "length": 100,
                "bytesCompleted": 40,
            }
        ],
    }

    with pytest.raises(FileNotFoundError, match="no completed readable file"):
        agent._resolve_downloaded_file(torrent)


def test_largest_completed_candidate_is_chosen(
    state_path: Path,
    download_root: Path,
) -> None:
    agent = _agent(state_path, download_root)
    small = download_root / "small.epub"
    large = download_root / "large.epub"
    small.write_bytes(b"a" * 10)
    large.write_bytes(b"b" * 50)

    torrent = {
        "downloadDir": str(download_root),
        "files": [
            {"name": "small.epub", "length": 10, "bytesCompleted": 10},
            {"name": "large.epub", "length": 50, "bytesCompleted": 50},
        ],
    }

    assert agent._resolve_downloaded_file(torrent) == large.resolve()


def test_no_candidates_raises_file_not_found(
    state_path: Path,
    download_root: Path,
) -> None:
    agent = _agent(state_path, download_root)
    torrent = {"downloadDir": str(download_root), "files": []}

    with pytest.raises(FileNotFoundError, match="no completed readable file"):
        agent._resolve_downloaded_file(torrent)


def test_missing_on_disk_candidate_is_skipped(
    state_path: Path,
    download_root: Path,
) -> None:
    agent = _agent(state_path, download_root)
    torrent = {
        "downloadDir": str(download_root),
        "files": [
            {
                "name": "ghost.epub",
                "length": 20,
                "bytesCompleted": 20,
            }
        ],
    }

    with pytest.raises(FileNotFoundError, match="no completed readable file"):
        agent._resolve_downloaded_file(torrent)


def test_incomplete_sibling_does_not_block_complete_file(
    state_path: Path,
    download_root: Path,
) -> None:
    agent = _agent(state_path, download_root)
    complete = download_root / "ready.pdf"
    complete.write_bytes(b"%PDF-complete")

    torrent = {
        "downloadDir": str(download_root),
        "files": [
            {"name": "partial.bin", "length": 100, "bytesCompleted": 1},
            {"name": "ready.pdf", "length": 13, "bytesCompleted": 13},
        ],
    }

    assert agent._resolve_downloaded_file(torrent) == complete.resolve()
