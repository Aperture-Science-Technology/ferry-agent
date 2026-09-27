"""GET /api/v1/mail/settings — forme de la reponse et valeurs derivees de la config."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from ferry_agent.config import get_settings
from ferry_agent.main import app
from ferry_agent.services import mail_policy
from tests.fakes import FakeSession, clear_app_deps, override_app_deps

_USER_ID = uuid.uuid4()


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _override_empty_db() -> None:
    async def fake_db():
        yield FakeSession()

    override_app_deps(fake_db, user_id=_USER_ID)


def test_mail_settings_shape_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMTP_USER", "")
    monkeypatch.setenv("SMTP_PASSWORD", "")
    monkeypatch.setenv("SMTP_FROM", "send@ferry-agent.example.test")
    monkeypatch.delenv("SMTP_REPLY_TO", raising=False)
    get_settings.cache_clear()

    _override_empty_db()
    try:
        with TestClient(app) as client:
            resp = client.get("/api/v1/mail/settings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["configured"] is False
        assert body["sender_address"] == "send@ferry-agent.example.test"
        assert body["reply_to"] is None
        assert body["hourly_quota"] == get_settings().email_send_hourly_quota
        assert body["daily_quota"] == get_settings().email_send_daily_quota
        assert body["allowed_domains"] == sorted(mail_policy.allowed_domains())
        assert set(body.keys()) == {
            "configured",
            "sender_address",
            "reply_to",
            "allowed_domains",
            "hourly_quota",
            "daily_quota",
        }
        # Ne doit pas reveler hote / port / identifiants.
        raw = resp.text.lower()
        assert "smtp_host" not in raw
        assert "password" not in raw
        assert "smtp.gmail.com" not in raw
    finally:
        clear_app_deps()


def test_mail_settings_configured_true_when_smtp_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMTP_HOST", "smtp.resend.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_SECURITY", "ssl")
    monkeypatch.setenv("SMTP_USER", "resend")
    monkeypatch.setenv("SMTP_PASSWORD", "re_test_key")
    monkeypatch.setenv("SMTP_FROM", "no-reply@ferry-agent.example.test")
    monkeypatch.setenv("SMTP_REPLY_TO", "support@example.test")
    get_settings.cache_clear()

    _override_empty_db()
    try:
        with TestClient(app) as client:
            resp = client.get("/api/v1/mail/settings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["configured"] is True
        assert body["sender_address"] == get_settings().smtp_from
        assert body["reply_to"] == "support@example.test"
        assert body["allowed_domains"] == sorted(mail_policy.allowed_domains())
    finally:
        clear_app_deps()
