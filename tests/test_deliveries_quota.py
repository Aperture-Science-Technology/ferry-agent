"""Quota d'envoi email verifie en amont de create_delivery (HTTP 429)."""

from __future__ import annotations

import uuid

import pytest
from fastapi import BackgroundTasks, HTTPException

from ferry_agent.api import deliveries
from ferry_agent.api.deps import CurrentUser
from ferry_agent.models import (
    DeliveryMethod,
    DeliveryTier,
    Device,
    DeviceBrand,
    LibraryItem,
    User,
)
from ferry_agent.schemas import DeliveryCreate
from tests.fakes import FakeSession


def _make_user(**overrides) -> User:
    values = {
        "id": uuid.uuid4(),
        "email": "reader@example.test",
        "kindle_email": "reader@kindle.com",
        "default_format": "epub",
    }
    values.update(overrides)
    return User(**values)


def _make_device(**overrides) -> Device:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "brand": DeviceBrand.kindle,
        "delivery_tier": DeliveryTier.A,
    }
    values.update(overrides)
    return Device(**values)


def _make_item(**overrides) -> LibraryItem:
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


async def test_create_delivery_email_quota_exceeded_returns_429_without_background_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(deliveries.mailer, "is_configured", lambda: True)

    async def boom(_db, _user_id):
        raise RuntimeError("quota d'envois atteint, réessayez plus tard")

    monkeypatch.setattr(deliveries.mail_policy, "enforce_send_quota", boom)

    user_id = uuid.uuid4()
    item = _make_item(user_id=user_id)
    device = _make_device(user_id=user_id, delivery_tier=DeliveryTier.A)
    profile = _make_user(id=user_id)
    db = FakeSession([item, device, profile])
    background_tasks = BackgroundTasks()

    payload = DeliveryCreate(
        library_item_id=item.id,
        device_id=device.id,
        method=DeliveryMethod.email,
    )

    with pytest.raises(HTTPException) as exc_info:
        await deliveries.create_delivery(
            payload,
            background_tasks,
            CurrentUser(id=user_id, email="reader@example.test"),
            db,
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.detail == "quota d'envois atteint, réessayez plus tard"
    assert not db.added
    assert len(background_tasks.tasks) == 0


async def test_create_delivery_email_passes_when_quota_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(deliveries.mailer, "is_configured", lambda: True)

    called: list[uuid.UUID] = []

    async def ok(db, user_id):
        called.append(user_id)

    monkeypatch.setattr(deliveries.mail_policy, "enforce_send_quota", ok)

    user_id = uuid.uuid4()
    item = _make_item(user_id=user_id)
    device = _make_device(user_id=user_id, delivery_tier=DeliveryTier.A)
    profile = _make_user(id=user_id)
    db = FakeSession([item, device, profile])
    background_tasks = BackgroundTasks()

    payload = DeliveryCreate(
        library_item_id=item.id,
        device_id=device.id,
        method=DeliveryMethod.email,
    )
    result = await deliveries.create_delivery(
        payload,
        background_tasks,
        CurrentUser(id=user_id, email="reader@example.test"),
        db,
    )

    assert called == [user_id]
    assert result.status.value == "queued"
    assert len(background_tasks.tasks) == 1
    assert db.added
