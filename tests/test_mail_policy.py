"""Tests de la politique d'envoi email (domaines Kindle + quotas)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from ferry_agent.config import get_settings
from ferry_agent.services import mail_policy

from tests.fakes import FakeSession


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.parametrize(
    "email",
    [
        "reader@kindle.com",
        "reader@kindle.co.uk",
        "reader@kindle.de",
        "reader@kindle.fr",
        "reader@kindle.it",
        "reader@kindle.es",
        "reader@kindle.com.br",
        "reader@kindle.com.au",
        "reader@kindle.co.jp",
        "reader@free.kindle.com",
        "Reader@Kindle.COM",
    ],
)
def test_is_allowed_recipient_accepts_kindle_domains(email: str) -> None:
    assert mail_policy.is_allowed_recipient(email) is True


@pytest.mark.parametrize(
    "email",
    [
        "reader@gmail.com",
        "reader@",
        "",
        "no-at-sign",
        "@kindle.com",
    ],
)
def test_is_allowed_recipient_rejects_non_kindle(email: str) -> None:
    assert mail_policy.is_allowed_recipient(email) is False


def test_allowed_domains_parses_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINDLE_EMAIL_DOMAINS", " kindle.com , ,KINDLE.FR ")
    get_settings.cache_clear()
    assert mail_policy.allowed_domains() == frozenset({"kindle.com", "kindle.fr"})


def test_recipient_not_allowed_message_is_actionable() -> None:
    msg = str(mail_policy.RecipientNotAllowed())
    assert "Send-to-Kindle" in msg
    assert "kindle.com" in msg
    assert "Manage Your Content and Devices" in msg


async def test_enforce_send_quota_hourly_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMAIL_SEND_HOURLY_QUOTA", "2")
    monkeypatch.setenv("EMAIL_SEND_DAILY_QUOTA", "80")
    get_settings.cache_clear()
    db = FakeSession([2])
    user_id = uuid.uuid4()

    with pytest.raises(RuntimeError, match="quota d'envois atteint"):
        await mail_policy.enforce_send_quota(db, user_id)

    assert db.commits == 0


async def test_enforce_send_quota_daily_global_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMAIL_SEND_HOURLY_QUOTA", "30")
    monkeypatch.setenv("EMAIL_SEND_DAILY_QUOTA", "5")
    get_settings.cache_clear()
    # hourly OK (1), daily global dépassé (5)
    db = FakeSession([1, 5])
    user_id = uuid.uuid4()

    with pytest.raises(RuntimeError, match="quota d'envois atteint"):
        await mail_policy.enforce_send_quota(db, user_id)

    assert db.commits == 0


async def test_enforce_send_quota_not_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMAIL_SEND_HOURLY_QUOTA", "30")
    monkeypatch.setenv("EMAIL_SEND_DAILY_QUOTA", "80")
    get_settings.cache_clear()
    db = FakeSession([3, 10])
    user_id = uuid.uuid4()

    await mail_policy.enforce_send_quota(db, user_id)
    assert db.commits == 0


async def test_count_recent_email_sends_filters_by_user() -> None:
    user_id = uuid.uuid4()
    db = FakeSession([4])
    since = datetime.now(timezone.utc) - timedelta(hours=1)

    count = await mail_policy.count_recent_email_sends(db, user_id=user_id, since=since)

    assert count == 4
    assert len(db.statements) == 1
    compiled = str(db.statements[0])
    assert "devices" in compiled.lower() or "device" in compiled.lower()


async def test_count_recent_email_sends_global_has_no_user_filter() -> None:
    db = FakeSession([7])
    since = datetime.now(timezone.utc) - timedelta(days=1)

    count = await mail_policy.count_recent_email_sends(db, user_id=None, since=since)

    assert count == 7
    assert len(db.statements) == 1
