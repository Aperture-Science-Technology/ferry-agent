"""Tests de la livraison tier A (Send-to-Kindle / email), sans DB reelle ni
envoi SMTP reel : `mailer.send_file` et `mailer.is_configured` sont
monkeypatches."""

import uuid
from pathlib import Path

import pytest
from fastapi import BackgroundTasks, HTTPException

from ferry_agent.api import deliveries
from ferry_agent.api.deps import CurrentUser
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
from ferry_agent.schemas import DeliveryCreate
from ferry_agent.services import delivery


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, execute_values=()):
        self.execute_values = list(execute_values)
        self.commits = 0
        self.statements = []
        self.added = []

    async def execute(self, statement):
        self.statements.append(statement)
        value = self.execute_values.pop(0) if self.execute_values else None
        return ScalarResult(value)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _value):
        return None

    def add(self, value):
        self.added.append(value)
        # Pas de flush reel : applique les defauts client-side de la
        # colonne (id/created_at/status...) comme le ferait SQLAlchemy.
        for column in value.__table__.columns:
            if getattr(value, column.name, None) is not None:
                continue
            default = column.default
            if default is None:
                continue
            if getattr(default, "is_callable", False):
                try:
                    setattr(value, column.name, default.arg())
                except TypeError:
                    setattr(value, column.name, default.arg(None))
            elif getattr(default, "is_scalar", False):
                setattr(value, column.name, default.arg)


def make_user(**overrides) -> User:
    values = {
        "id": uuid.uuid4(),
        "email": "reader@example.test",
        "kindle_email": "reader@kindle.com",
        "default_format": "epub",
    }
    values.update(overrides)
    return User(**values)


def make_device(**overrides) -> Device:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "brand": DeviceBrand.kindle,
        "delivery_tier": DeliveryTier.A,
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
        "method": DeliveryMethod.email,
    }
    values.update(overrides)
    return DeliveryJob(**values)


async def test_deliver_tier_a_sends_native_format_and_marks_delivered(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = {}

    async def fake_send_file(file_path, filename, recipient_email, kindle=False):
        sent.update(file_path=file_path, filename=filename, recipient_email=recipient_email, kindle=kindle)

    monkeypatch.setattr(delivery.mailer, "send_file", fake_send_file)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user()
    device = make_device()
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert job.status == DeliveryStatus.delivered
    assert job.delivered_at is not None
    assert sent["kindle"] is True
    assert sent["recipient_email"] == user.kindle_email
    assert sent["file_path"] == item.storage_path


async def test_deliver_tier_a_converts_epub_to_mobi_for_kindle_default_format(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    converted = {}
    sent = {}

    async def fake_epub_to_mobi(epub_path, mobi_path=None):
        converted["called_with"] = epub_path
        return str(Path(epub_path).with_suffix(".mobi"))

    async def fake_send_file(file_path, filename, recipient_email, kindle=False):
        sent.update(file_path=file_path, filename=filename)

    monkeypatch.setattr(delivery.converters, "epub_to_mobi", fake_epub_to_mobi)
    monkeypatch.setattr(delivery.mailer, "send_file", fake_send_file)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user(default_format="mobi")
    device = make_device(brand=DeviceBrand.kindle)
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert converted["called_with"] == item.storage_path
    assert sent["filename"] == "book.mobi"
    assert job.status == DeliveryStatus.delivered


async def test_deliver_tier_a_skips_conversion_for_non_kindle_device(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = {}

    async def fail_convert(*_args, **_kwargs):
        raise AssertionError("la conversion ne doit pas etre appelee pour un device non-kindle")

    async def fake_send_file(file_path, filename, recipient_email, kindle=False):
        sent.update(file_path=file_path, filename=filename)

    monkeypatch.setattr(delivery.converters, "epub_to_mobi", fail_convert)
    monkeypatch.setattr(delivery.mailer, "send_file", fake_send_file)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user(default_format="mobi")
    device = make_device(brand=DeviceBrand.kobo)
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert sent["file_path"] == item.storage_path
    assert job.status == DeliveryStatus.delivered


async def test_deliver_tier_a_fails_without_kindle_email(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user(kindle_email=None)
    device = make_device()
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed
    assert job.error and "kindle_email" in job.error


async def test_deliver_tier_a_fails_when_smtp_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: False)

    user = make_user()
    device = make_device()
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed
    assert job.error and "SMTP" in job.error


async def test_deliver_tier_a_marks_failed_on_send_error(monkeypatch: pytest.MonkeyPatch) -> None:
    async def raising_send(*_args, **_kwargs):
        raise RuntimeError("smtp boom")

    monkeypatch.setattr(delivery.mailer, "send_file", raising_send)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user()
    device = make_device()
    item = make_item()
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert job.status == DeliveryStatus.failed
    assert job.error == "smtp boom"


async def test_deliver_routes_tier_a_via_full_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = {}

    async def fake_send_file(file_path, filename, recipient_email, kindle=False):
        sent["kindle"] = kindle

    monkeypatch.setattr(delivery.mailer, "send_file", fake_send_file)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user()
    device = make_device()
    item = make_item()
    job = make_job(library_item_id=item.id, device_id=device.id)
    db = FakeSession([item, device, user])

    url = await delivery.deliver(db, job)

    assert url is None
    assert job.status == DeliveryStatus.delivered
    assert sent["kindle"] is True


async def test_create_delivery_schedules_background_task_for_tier_a_device(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(deliveries.mailer, "is_configured", lambda: True)
    user_id = uuid.uuid4()
    item = make_item(user_id=user_id)
    device = make_device(user_id=user_id, delivery_tier=DeliveryTier.A)
    db = FakeSession([item, device])
    background_tasks = BackgroundTasks()

    payload = DeliveryCreate(library_item_id=item.id, device_id=device.id, method=DeliveryMethod.email)
    result = await deliveries.create_delivery(
        payload, background_tasks, CurrentUser(id=user_id, email="reader@example.test"), db
    )

    assert result.status == DeliveryStatus.queued
    assert result.download_url is None
    assert len(background_tasks.tasks) == 1
    assert db.added and isinstance(db.added[0], DeliveryJob)


async def test_create_delivery_rejects_method_incoherent_with_device_tier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ex. demander `email` sur un Kobo tier C : 400, pas de job cree."""
    user_id = uuid.uuid4()
    item = make_item(user_id=user_id)
    device = make_device(user_id=user_id, brand=DeviceBrand.kobo, delivery_tier=DeliveryTier.C)
    db = FakeSession([item, device])
    background_tasks = BackgroundTasks()

    payload = DeliveryCreate(library_item_id=item.id, device_id=device.id, method=DeliveryMethod.email)

    with pytest.raises(HTTPException) as exc_info:
        await deliveries.create_delivery(
            payload, background_tasks, CurrentUser(id=user_id, email="reader@example.test"), db
        )

    assert exc_info.value.status_code == 400
    assert not db.added
    assert len(background_tasks.tasks) == 0


async def test_create_delivery_rejects_email_when_smtp_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(deliveries.mailer, "is_configured", lambda: False)
    user_id = uuid.uuid4()
    item = make_item(user_id=user_id)
    device = make_device(user_id=user_id, delivery_tier=DeliveryTier.A)
    db = FakeSession([item, device])
    background_tasks = BackgroundTasks()

    payload = DeliveryCreate(library_item_id=item.id, device_id=device.id, method=DeliveryMethod.email)

    with pytest.raises(HTTPException) as exc_info:
        await deliveries.create_delivery(
            payload, background_tasks, CurrentUser(id=user_id, email="reader@example.test"), db
        )

    assert exc_info.value.status_code == 400
