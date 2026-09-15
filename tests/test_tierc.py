"""Tests du mini-catalogue HTTP + code court (tier C), sans DB reelle."""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from ferry_agent.api import deliveries
from ferry_agent.api.deps import CurrentUser
from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.models import (
    DeliveryJob,
    DeliveryMethod,
    DeliveryStatus,
    DeliveryTier,
    Device,
    DeviceBrand,
    LibraryItem,
    ShortCode,
    User,
)
from ferry_agent.schemas import DeliveryCreate
from ferry_agent.services import delivery, tierc
from fastapi import BackgroundTasks

from tests.fakes import FakeSession


def override_db(sessions: list[FakeSession]):
    async def _get_db():
        yield sessions.pop(0)

    return _get_db


def make_short_code(**overrides) -> ShortCode:
    values = {
        "id": uuid.uuid4(),
        "code": "ABCD2345",
        "delivery_job_id": uuid.uuid4(),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "downloads_left": 1,
    }
    values.update(overrides)
    return ShortCode(**values)


# --- services/tierc.py --------------------------------------------------


def test_generate_short_code_uses_unambiguous_alphabet() -> None:
    code = tierc.generate_short_code()
    assert len(code) == tierc.CODE_LENGTH
    assert set(code) <= set(tierc.CODE_ALPHABET)
    assert not set(code) & {"0", "O", "1", "I", "L"}


async def test_create_download_session_builds_public_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        tierc, "get_settings", lambda: SimpleNamespace(public_base_url="https://ferry.example.test")
    )
    job_id = uuid.uuid4()
    db = FakeSession([None])  # verification d'unicite : pas de collision

    short_code, url = await tierc.create_download_session(db, job_id, downloads_left=3, ttl_minutes=60)

    assert short_code.delivery_job_id == job_id
    assert short_code.downloads_left == 3
    assert url == f"https://ferry.example.test/c/{short_code.code}"


async def test_get_valid_short_code_rejects_expired() -> None:
    expired = make_short_code(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    db = FakeSession([expired])

    assert await tierc.get_valid_short_code(db, "abcd2345") is None


async def test_get_valid_short_code_rejects_exhausted() -> None:
    exhausted = make_short_code(downloads_left=0)
    db = FakeSession([exhausted])

    assert await tierc.get_valid_short_code(db, "ABCD2345") is None


async def test_get_valid_short_code_accepts_unlimited_downloads() -> None:
    unlimited = make_short_code(downloads_left=None)
    db = FakeSession([unlimited])

    assert await tierc.get_valid_short_code(db, "ABCD2345") is unlimited


async def test_get_valid_short_code_is_case_insensitive() -> None:
    valid = make_short_code()
    db = FakeSession([valid])

    assert await tierc.get_valid_short_code(db, "abcd2345") is valid


def test_render_page_has_no_javascript() -> None:
    page = tierc.render_page("ABCD2345", "Dune", "Frank Herbert")
    assert "<script" not in page.lower()
    assert "Dune" in page
    assert "Frank Herbert" in page
    assert "/c/ABCD2345/download" in page


def test_render_missing_has_no_javascript() -> None:
    page = tierc.render_missing()
    assert "<script" not in page.lower()


# --- services/delivery.py (tier C) --------------------------------------


async def test_deliver_tier_c_creates_session_and_marks_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        tierc, "get_settings", lambda: SimpleNamespace(public_base_url="https://ferry.example.test")
    )
    user = User(id=uuid.uuid4(), email="reader@example.test", default_format="epub")
    item = LibraryItem(
        id=uuid.uuid4(),
        user_id=user.id,
        title="Dune",
        author="Herbert",
        original_format="epub",
        storage_path="/tmp/fake-library/book.epub",
    )
    device = Device(
        id=uuid.uuid4(),
        user_id=user.id,
        brand=DeviceBrand.kobo,
        delivery_tier=DeliveryTier.C,
    )
    job = DeliveryJob(
        id=uuid.uuid4(),
        library_item_id=item.id,
        device_id=device.id,
        status=DeliveryStatus.queued,
        method=DeliveryMethod.email,
    )
    db = FakeSession([None])  # verification d'unicite du code

    url = await delivery._deliver_tier_c(db, job, item, device, user)

    assert job.status == DeliveryStatus.sent
    assert job.method == DeliveryMethod.browser_code
    assert job.target_format == "epub"
    assert url.startswith("https://ferry.example.test/c/")


async def test_deliver_tier_c_fails_when_requested_format_cannot_be_produced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pas de succes tier C si le format demande ne peut pas etre produit."""

    async def raising_pdf(*_args, **_kwargs):
        raise RuntimeError("conversion boom")

    monkeypatch.setattr(delivery.converters, "epub_to_pdf", raising_pdf)

    user = User(id=uuid.uuid4(), email="reader@example.test", default_format="epub")
    item = LibraryItem(
        id=uuid.uuid4(),
        user_id=user.id,
        title="Dune",
        author="Herbert",
        original_format="epub",
        storage_path="/tmp/fake-library/book.epub",
    )
    device = Device(
        id=uuid.uuid4(),
        user_id=user.id,
        brand=DeviceBrand.kobo,
        delivery_tier=DeliveryTier.C,
    )
    job = DeliveryJob(
        id=uuid.uuid4(),
        library_item_id=item.id,
        device_id=device.id,
        status=DeliveryStatus.queued,
        method=DeliveryMethod.browser_code,
    )
    db = FakeSession()

    url = await delivery._deliver_tier_c(db, job, item, device, user, requested_format="pdf")

    assert url is None
    assert job.status == DeliveryStatus.failed
    assert job.error == delivery.converters.CONVERSION_FAILED_USER_MESSAGE


async def test_create_delivery_returns_download_url_for_tier_c(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        tierc, "get_settings", lambda: SimpleNamespace(public_base_url="https://ferry.example.test")
    )
    user_id = uuid.uuid4()
    user = User(id=user_id, email="reader@example.test", default_format="epub")
    item = LibraryItem(
        id=uuid.uuid4(),
        user_id=user_id,
        title="Dune",
        author="",
        original_format="epub",
        storage_path="/tmp/fake-library/book.epub",
    )
    device = Device(id=uuid.uuid4(), user_id=user_id, brand=DeviceBrand.kobo, delivery_tier=DeliveryTier.C)
    # create_delivery valide item+device, puis delivery.deliver() les
    # re-resout (item, device, user) avant de creer la session.
    db = FakeSession([item, device, item, device, user, None])

    payload = DeliveryCreate(library_item_id=item.id, device_id=device.id, method=DeliveryMethod.browser_code)
    result = await deliveries.create_delivery(
        payload, BackgroundTasks(), CurrentUser(id=user_id, email="reader@example.test"), db
    )

    assert result.status == DeliveryStatus.sent
    assert result.method == DeliveryMethod.browser_code
    assert result.download_url is not None
    assert result.download_url.startswith("https://ferry.example.test/c/")


# --- api/tierc.py (routes publiques, via TestClient) --------------------


def test_catalog_page_renders_html_without_js() -> None:
    item = LibraryItem(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Dune",
        author="Frank Herbert",
        original_format="epub",
        storage_path="/tmp/fake-library/book.epub",
    )
    short_code = make_short_code(code="WXYZ9876", delivery_job_id=uuid.uuid4())

    sessions = [FakeSession([short_code, item])]
    app.dependency_overrides[get_db] = override_db(sessions)
    try:
        with TestClient(app) as client:
            resp = client.get("/c/WXYZ9876")
        assert resp.status_code == 200
        assert "<script" not in resp.text.lower()
        assert "Dune" in resp.text
        assert "/c/WXYZ9876/download" in resp.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_catalog_page_missing_code_returns_404_without_js() -> None:
    sessions = [FakeSession([None])]
    app.dependency_overrides[get_db] = override_db(sessions)
    try:
        with TestClient(app) as client:
            resp = client.get("/c/NOPECODE")
        assert resp.status_code == 404
        assert "<script" not in resp.text.lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_download_streams_file_decrements_and_expires(tmp_path) -> None:
    book = tmp_path / "book.epub"
    book.write_bytes(b"fake-epub-bytes")

    user_id = uuid.uuid4()
    item = LibraryItem(
        id=uuid.uuid4(),
        user_id=user_id,
        title="Dune",
        author="Herbert",
        original_format="epub",
        storage_path=str(book),
    )
    device = Device(
        id=uuid.uuid4(),
        user_id=user_id,
        brand=DeviceBrand.kobo,
        delivery_tier=DeliveryTier.C,
    )
    job = DeliveryJob(
        id=uuid.uuid4(),
        library_item_id=item.id,
        device_id=device.id,
        status=DeliveryStatus.sent,
        method=DeliveryMethod.browser_code,
        target_format="epub",
    )
    short_code = make_short_code(code="DLCODE99", delivery_job_id=job.id, downloads_left=1)

    sessions = [
        FakeSession([short_code, job, item, device]),  # premier telechargement : OK
        FakeSession([short_code]),  # second essai : downloads_left epuise -> 404
    ]
    app.dependency_overrides[get_db] = override_db(sessions)
    try:
        with TestClient(app) as client:
            resp = client.get("/c/DLCODE99/download")
            assert resp.status_code == 200
            assert resp.headers["content-type"] == "application/epub+zip"
            assert 'attachment; filename="book.epub"' in resp.headers["content-disposition"]
            assert resp.content == b"fake-epub-bytes"
            assert short_code.downloads_left == 0
            assert job.status == DeliveryStatus.delivered
            assert job.delivered_at is not None

            resp2 = client.get("/c/dlcode99/download")
            assert resp2.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
