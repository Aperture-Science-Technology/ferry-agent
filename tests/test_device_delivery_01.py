"""Regressions FA-DEVICE-DELIVERY-01."""

from ferry_agent.models import DeliveryTier, Device
from ferry_agent.services.delivery_methods import available_delivery_methods


def test_native_catalog_is_available_without_smtp():
    methods = available_delivery_methods(Device(delivery_tier=DeliveryTier.D), False)
    assert [(m.method.value, m.available) for m in methods] == [("opds", True)]


def test_purge_removes_sensitive_handles_without_mutating_input():
    from ferry_agent.services.gateways import sanitize_finished_payload

    payload = {
        "query": "Dune",
        "results": [
            {
                "title": "Dune",
                "download_url": "secret",
                "magnet_url": "secret",
                "guid": "secret",
                "indexer_id": 2,
                "nested": {"guid": "secret"},
            }
        ],
    }
    assert sanitize_finished_payload(payload) == {"query": "Dune", "results": [{"title": "Dune", "nested": {}}]}
    assert payload["results"][0]["download_url"] == "secret"


def test_mail_test_is_a_real_message_with_supported_attachment(monkeypatch):
    from ferry_agent.services import mailer
    from ferry_agent.config import get_settings

    monkeypatch.setenv("SMTP_FROM", "sender@example.test")
    get_settings.cache_clear()
    sent = []

    class Relay:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def login(self, *args):
            pass

        def send_message(self, message):
            sent.append(message)
            return {}

    monkeypatch.setattr(mailer, "_connect", Relay)
    try:
        mailer._send_test_sync("reader@kindle.com")
        assert sent[0]["To"] == "reader@kindle.com"
        assert sent[0]["From"] == "sender@example.test"
        attachment = next(sent[0].iter_attachments())
        assert attachment.get_filename() == "test-ferry.txt"
        assert "Ferry" in attachment.get_content()
    finally:
        get_settings.cache_clear()
