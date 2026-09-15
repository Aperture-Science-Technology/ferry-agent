"""Tests de la livraison tier B (upload Dropbox / Google Drive), sans DB
reelle ni appel reseau reel : `httpx.MockTransport` intercepte les
requetes."""

import json
import uuid
from pathlib import Path

import httpx
import pytest

from ferry_agent.models import (
    DeliveryJob,
    DeliveryMethod,
    DeliveryStatus,
    DeliveryTier,
    Device,
    DeviceBrand,
    LibraryItem,
    User,
)
from ferry_agent.services import cloud_links, delivery

from tests.fakes import FakeSession


def make_user(**overrides) -> User:
    values = {"id": uuid.uuid4(), "email": "reader@example.test", "default_format": "epub"}
    values.update(overrides)
    return User(**values)


def make_device(**overrides) -> Device:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "brand": DeviceBrand.kobo,
        "delivery_tier": DeliveryTier.B,
        "link_ref": json.dumps({"provider": "dropbox", "token": "dbx-access-tok"}),
    }
    values.update(overrides)
    return Device(**values)


def make_item(**overrides) -> LibraryItem:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "title": "Dune",
        "author": "Herbert",
        "original_format": "epub",
        "storage_path": "/tmp/fake-library/book.epub",
    }
    values.update(overrides)
    return LibraryItem(**values)


def make_job(**overrides) -> DeliveryJob:
    values = {
        "id": uuid.uuid4(),
        "library_item_id": uuid.uuid4(),
        "device_id": uuid.uuid4(),
        "status": DeliveryStatus.queued,
        "method": DeliveryMethod.dropbox,
    }
    values.update(overrides)
    return DeliveryJob(**values)


# --- upload_to_dropbox -------------------------------------------------


async def test_upload_to_dropbox_sends_correct_headers_and_body() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["api_arg"] = json.loads(request.headers["dropbox-api-arg"])
        captured["body"] = request.content
        return httpx.Response(200, json={"path_display": "/book.epub"})

    transport = httpx.MockTransport(handler)
    result = await cloud_links.upload_to_dropbox(
        "dbx-tok", "/book.epub", b"epub-bytes", "book.epub", transport=transport
    )

    assert captured["url"] == cloud_links.DROPBOX_UPLOAD_URL
    assert captured["auth"] == "Bearer dbx-tok"
    assert captured["api_arg"] == {"path": "/book.epub", "mode": "add", "autorename": True}
    assert captured["body"] == b"epub-bytes"
    assert result == {"path_display": "/book.epub"}


async def test_upload_to_dropbox_raises_on_401() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "expired_access_token"}))

    with pytest.raises(cloud_links.CloudLinkError):
        await cloud_links.upload_to_dropbox("stale-tok", "/book.epub", b"data", "book.epub", transport=transport)


# --- Google Drive --------------------------------------------------------


async def test_get_drive_access_posts_refresh_grant() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["params"] = dict(pair.split("=") for pair in request.content.decode().split("&"))
        return httpx.Response(200, json={"access_token": "new-access-tok"})

    transport = httpx.MockTransport(handler)
    token = await cloud_links.get_drive_access(
        "refresh-tok", "client-id", "client-secret", transport=transport
    )

    assert token == "new-access-tok"
    assert captured["params"]["grant_type"] == "refresh_token"
    assert captured["params"]["client_id"] == "client-id"
    assert captured["params"]["client_secret"] == "client-secret"
    assert captured["params"]["refresh_token"] == "refresh-tok"


async def test_get_drive_access_raises_on_401() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "invalid_grant"}))

    with pytest.raises(cloud_links.CloudLinkError):
        await cloud_links.get_drive_access("revoked", "cid", "csecret", transport=transport)


async def test_upload_to_drive_posts_multipart_with_metadata_and_bearer() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = request.content
        return httpx.Response(200, json={"id": "drive-file-id"})

    transport = httpx.MockTransport(handler)
    file_id = await cloud_links.upload_to_drive(
        "drive-tok", "book.epub", b"epub-bytes", transport=transport
    )

    assert file_id == "drive-file-id"
    assert captured["auth"] == "Bearer drive-tok"
    assert b'"name": "book.epub"' in captured["body"]
    assert b"epub-bytes" in captured["body"]


async def test_upload_to_drive_raises_on_401() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "invalid_token"}))

    with pytest.raises(cloud_links.CloudLinkError):
        await cloud_links.upload_to_drive("stale-tok", "book.epub", b"data", transport=transport)


# --- parse_link_ref / upload_job_file ------------------------------------


def test_parse_link_ref_selects_dropbox_provider() -> None:
    parsed = cloud_links.parse_link_ref(json.dumps({"provider": "dropbox", "token": "abc"}))
    assert parsed == {"provider": "dropbox", "token": "abc"}


def test_parse_link_ref_selects_drive_provider() -> None:
    parsed = cloud_links.parse_link_ref(json.dumps({"provider": "drive", "refresh_token": "xyz"}))
    assert parsed == {"provider": "drive", "refresh_token": "xyz"}


def test_parse_link_ref_rejects_unknown_provider() -> None:
    with pytest.raises(cloud_links.CloudLinkError):
        cloud_links.parse_link_ref(json.dumps({"provider": "icloud", "token": "abc"}))


def test_parse_link_ref_rejects_invalid_json() -> None:
    with pytest.raises(cloud_links.CloudLinkError):
        cloud_links.parse_link_ref("not-json")


async def test_upload_job_file_dispatches_to_dropbox() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer dbx-tok"
        return httpx.Response(200, json={"path_display": "/book.epub"})

    transport = httpx.MockTransport(handler)
    link_ref = json.dumps({"provider": "dropbox", "token": "dbx-tok"})

    remote_ref = await cloud_links.upload_job_file(link_ref, "book.epub", b"data", transport=transport)

    assert remote_ref == "/book.epub"


async def test_upload_job_file_dispatches_to_drive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        cloud_links,
        "get_settings",
        lambda: type("S", (), {"google_client_id": "cid", "google_client_secret": "csecret"})(),
    )

    calls = {"refresh": False, "upload": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == cloud_links.GOOGLE_TOKEN_URL:
            calls["refresh"] = True
            return httpx.Response(200, json={"access_token": "fresh-tok"})
        calls["upload"] = True
        assert request.headers["authorization"] == "Bearer fresh-tok"
        return httpx.Response(200, json={"id": "file-123"})

    transport = httpx.MockTransport(handler)
    link_ref = json.dumps({"provider": "drive", "refresh_token": "refresh-tok"})

    remote_ref = await cloud_links.upload_job_file(link_ref, "book.epub", b"data", transport=transport)

    assert remote_ref == "drive:file-123"
    assert calls == {"refresh": True, "upload": True}


async def test_upload_job_file_drive_fails_when_google_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        cloud_links,
        "get_settings",
        lambda: type("S", (), {"google_client_id": None, "google_client_secret": None})(),
    )
    link_ref = json.dumps({"provider": "drive", "refresh_token": "refresh-tok"})

    with pytest.raises(cloud_links.CloudLinkError):
        await cloud_links.upload_job_file(link_ref, "book.epub", b"data")


# --- services/delivery.py (tier B) --------------------------------------


async def test_deliver_tier_b_uploads_and_marks_delivered(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    book = tmp_path / "book.epub"
    book.write_bytes(b"epub-bytes")

    async def fake_upload_job_file(link_ref_json, filename, file_bytes):
        assert filename == "book.epub"
        assert file_bytes == b"epub-bytes"
        return "/book.epub"

    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload_job_file)

    user = make_user()
    device = make_device()
    item = make_item(storage_path=str(book))
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert job.status == DeliveryStatus.delivered
    assert job.method == DeliveryMethod.dropbox
    assert job.delivered_at is not None


async def test_deliver_tier_b_marks_drive_method_for_drive_provider(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    book = tmp_path / "book.epub"
    book.write_bytes(b"epub-bytes")

    async def fake_upload_job_file(link_ref_json, filename, file_bytes):
        return "drive:file-id"

    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload_job_file)

    user = make_user()
    device = make_device(link_ref=json.dumps({"provider": "drive", "refresh_token": "rt"}))
    item = make_item(storage_path=str(book))
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert job.status == DeliveryStatus.delivered
    assert job.method == DeliveryMethod.drive


async def test_deliver_tier_b_fails_without_link_ref() -> None:
    user = make_user()
    device = make_device(link_ref=None)
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed
    assert job.error and "non lie" in job.error


async def test_deliver_tier_b_fails_on_invalid_link_ref() -> None:
    user = make_user()
    device = make_device(link_ref="not-json")
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed


async def test_deliver_tier_b_converts_non_epub_before_upload(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    pdf = tmp_path / "book.pdf"
    pdf.write_bytes(b"pdf-bytes")
    epub = tmp_path / "book.epub"
    epub.write_bytes(b"converted-epub-bytes")

    converted = {}

    async def fake_convert_to_epub(src_path, epub_path=None, extra_args=None):
        converted["called_with"] = src_path
        return str(epub)

    uploaded = {}

    async def fake_upload_job_file(link_ref_json, filename, file_bytes):
        uploaded.update(filename=filename, file_bytes=file_bytes)
        return "/book.epub"

    monkeypatch.setattr(delivery.converters, "convert_to_epub", fake_convert_to_epub)
    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload_job_file)

    user = make_user()
    device = make_device()
    item = make_item(original_format="pdf", storage_path=str(pdf))
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert converted["called_with"] == str(pdf)
    assert uploaded["filename"] == "book.epub"
    assert uploaded["file_bytes"] == b"converted-epub-bytes"
    assert job.status == DeliveryStatus.delivered


async def test_deliver_tier_b_fails_when_calibre_unavailable(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Sans Calibre : failed + message actionnable, aucun upload PDF/autre format."""
    pdf = tmp_path / "book.pdf"
    pdf.write_bytes(b"pdf-bytes")
    uploaded = {}

    async def raising_convert(*_args, **_kwargs):
        raise RuntimeError("ebook-convert indisponible: conversion vers EPUB impossible")

    async def fake_upload_job_file(link_ref_json, filename, file_bytes):
        uploaded.update(filename=filename, file_bytes=file_bytes)
        return "/book.pdf"

    monkeypatch.setattr(delivery.converters, "convert_to_epub", raising_convert)
    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload_job_file)

    user = make_user()
    device = make_device()
    item = make_item(original_format="pdf", storage_path=str(pdf))
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed
    assert job.error == delivery.converters.CONVERSION_FAILED_USER_MESSAGE
    assert uploaded == {}


async def test_deliver_tier_b_uploads_requested_pdf_not_silent_epub(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Demander PDF depuis un EPUB : upload PDF, jamais d'EPUB en succes."""
    book = tmp_path / "book.epub"
    book.write_bytes(b"epub-bytes")
    pdf = tmp_path / "book.pdf"
    pdf.write_bytes(b"pdf-bytes-padded" + b"\x00" * 1024)

    converted = {}
    uploaded = {}

    async def fake_epub_to_pdf(epub_path, pdf_path=None):
        converted["called_with"] = epub_path
        return str(pdf)

    async def fake_upload_job_file(link_ref_json, filename, file_bytes):
        uploaded.update(filename=filename, file_bytes=file_bytes)
        return "/book.pdf"

    monkeypatch.setattr(delivery.converters, "epub_to_pdf", fake_epub_to_pdf)
    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload_job_file)

    user = make_user(default_format="epub")
    device = make_device()
    item = make_item(storage_path=str(book))
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user, requested_format="pdf")

    assert converted["called_with"] == str(book)
    assert uploaded["filename"] == "book.pdf"
    assert uploaded["file_bytes"].startswith(b"pdf-bytes-padded")
    assert job.status == DeliveryStatus.delivered
    assert job.target_format == "pdf"

    book = tmp_path / "book.epub"
    book.write_bytes(b"epub-bytes")

    async def raising_upload(*_args, **_kwargs):
        raise cloud_links.CloudLinkError("token Dropbox invalide/expire (401, a relier)")

    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", raising_upload)

    user = make_user()
    device = make_device()
    item = make_item(storage_path=str(book))
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed
    assert job.error and "401" in job.error


async def test_deliver_routes_tier_b_via_full_lookup(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    book = tmp_path / "book.epub"
    book.write_bytes(b"epub-bytes")

    async def fake_upload_job_file(link_ref_json, filename, file_bytes):
        return "/book.epub"

    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload_job_file)

    user = make_user()
    device = make_device()
    item = make_item(user_id=user.id, storage_path=str(book))
    job = make_job(library_item_id=item.id, device_id=device.id)
    db = FakeSession([item, device, user])

    url = await delivery.deliver(db, job)

    assert url is None
    assert job.status == DeliveryStatus.delivered
