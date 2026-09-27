"""Garde de formats Send-to-Kindle (Amazon, post-2023)."""

from ferry_agent.services import kindle_formats


def test_resolve_kindle_target_keeps_supported_formats() -> None:
    assert kindle_formats.resolve_kindle_target("epub", None, "pdf") == "epub"
    assert kindle_formats.resolve_kindle_target("pdf", None, "epub") == "pdf"


def test_resolve_kindle_target_maps_legacy_to_epub() -> None:
    assert kindle_formats.resolve_kindle_target("mobi", None, "epub") == "epub"
    assert kindle_formats.resolve_kindle_target("azw3", None, "epub") == "epub"


def test_resolve_kindle_target_maps_unknown_to_epub() -> None:
    assert kindle_formats.resolve_kindle_target("cbz", None, "epub") == "epub"


def test_resolve_kindle_target_normalizes_case_and_dot() -> None:
    assert kindle_formats.resolve_kindle_target("EPUB", None, "pdf") == "epub"
    assert kindle_formats.resolve_kindle_target(".EPUB", None, "pdf") == "epub"


def test_resolve_kindle_target_falls_back_to_default_when_requested_is_none() -> None:
    assert kindle_formats.resolve_kindle_target(None, "pdf", "epub") == "pdf"
    assert kindle_formats.resolve_kindle_target(None, "mobi", "epub") == "epub"


def test_is_supported_and_requires_conversion() -> None:
    assert kindle_formats.is_supported("epub") is True
    assert kindle_formats.is_supported("mobi") is False
    assert kindle_formats.requires_conversion("mobi") is True
    assert kindle_formats.requires_conversion("epub") is False
