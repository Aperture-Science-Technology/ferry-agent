"""Tests du mailer SMTP (TLS verifie, modes ssl/starttls, garde de taille)."""

from __future__ import annotations

import email
import smtplib
import ssl
import time
from datetime import UTC, datetime, timedelta
from email import policy
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from ferry_agent.services import mailer


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    mailer.get_settings.cache_clear()
    yield
    mailer.get_settings.cache_clear()


def _configure_smtp(monkeypatch, **env: str) -> None:
    defaults = {
        "SMTP_HOST": "smtp.test",
        "SMTP_PORT": "587",
        "SMTP_USER": "u@test",
        "SMTP_PASSWORD": "p",
        "SMTP_SECURITY": "starttls",
        "SMTP_FROM": "send@ferry-agent.test",
    }
    defaults.update(env)
    for key, value in defaults.items():
        monkeypatch.setenv(key, value)
    mailer.get_settings.cache_clear()


def test_starttls_uses_verifying_context(monkeypatch, tmp_path: Path) -> None:
    captured: dict = {}
    epub = tmp_path / "x.epub"
    epub.write_bytes(b"PK\x03\x04fake-epub")

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            captured["host"], captured["port"], captured["timeout"] = host, port, timeout

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def ehlo(self):
            return (250, b"ok")

        def starttls(self, *, context=None):
            captured["context"] = context

        def login(self, user, password):
            captured["login"] = (user, password)

        def send_message(self, message):
            captured["message"] = message

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    _configure_smtp(monkeypatch)

    mailer._send_sync(str(epub), "x.epub", "reader@kindle.com", kindle=True)

    ctx = captured["context"]
    assert ctx is not None, "starttls() sans contexte = certificat non verifie"
    assert ctx.verify_mode == ssl.CERT_REQUIRED
    assert ctx.check_hostname is True


def test_ssl_mode_uses_smtp_ssl_not_smtp(monkeypatch, tmp_path: Path) -> None:
    captured: dict = {}
    epub = tmp_path / "x.epub"
    epub.write_bytes(b"PK\x03\x04fake-epub")

    class FakeSMTP_SSL:
        def __init__(self, host, port, timeout=None, context=None):
            captured["host"] = host
            captured["port"] = port
            captured["timeout"] = timeout
            captured["context"] = context

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def login(self, user, password):
            captured["login"] = (user, password)

        def send_message(self, message):
            captured["sent"] = True

    def smtp_must_not_be_called(*_a, **_k):
        raise AssertionError("smtplib.SMTP ne doit pas etre appele en mode ssl")

    monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", FakeSMTP_SSL)
    monkeypatch.setattr(mailer.smtplib, "SMTP", smtp_must_not_be_called)
    _configure_smtp(monkeypatch, SMTP_PORT="465", SMTP_SECURITY="ssl")

    mailer._send_sync(str(epub), "x.epub", "reader@kindle.com", kindle=True)

    assert captured.get("sent") is True
    ctx = captured["context"]
    assert ctx is not None
    assert ctx.verify_mode == ssl.CERT_REQUIRED
    assert ctx.check_hostname is True


def test_is_configured_false_when_starttls_on_port_465(monkeypatch) -> None:
    _configure_smtp(monkeypatch, SMTP_PORT="465", SMTP_SECURITY="starttls")
    assert mailer.is_configured() is False


def test_message_too_large_raises_before_send(monkeypatch, tmp_path: Path) -> None:
    sent = {"called": False}
    epub = tmp_path / "big.epub"
    epub.write_bytes(b"x" * 2048)

    class FakeSMTP:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def ehlo(self):
            return (250, b"ok")

        def starttls(self, *, context=None):
            return None

        def login(self, user, password):
            return None

        def send_message(self, message):
            sent["called"] = True

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    _configure_smtp(
        monkeypatch,
        SMTP_MAX_MESSAGE_BYTES="200",
        AMAZON_SEND_TO_KINDLE_MAX_BYTES="50",
    )

    with pytest.raises(mailer.MessageTooLargeForRelay) as excinfo:
        mailer._send_sync(str(epub), "big.epub", "reader@kindle.com", kindle=True)

    assert "tier C" in str(excinfo.value) or "telechargement navigateur" in str(excinfo.value)
    assert sent["called"] is False


def test_build_message_sets_required_headers(monkeypatch, tmp_path: Path) -> None:
    epub = tmp_path / "livre.epub"
    epub.write_bytes(b"PK\x03\x04")
    _configure_smtp(
        monkeypatch,
        SMTP_FROM="send@ferry-agent.test",
        SMTP_REPLY_TO="user@example.com",
    )

    message = mailer.build_message(str(epub), "livre.epub", "reader@kindle.com", kindle=True)

    assert message["From"] == "send@ferry-agent.test"
    assert message["To"] == "reader@kindle.com"
    assert message["Subject"] == "Votre document"
    assert message["Date"]
    assert message["Message-ID"]
    assert "ferry-agent.test" in message["Message-ID"]
    assert message["Reply-To"] == "user@example.com"


def _make_localhost_tls_material(tmp_path: Path) -> tuple[Path, Path, Path]:
    """CA + certificat serveur (SAN 127.0.0.1) pour aiosmtpd STARTTLS."""
    import ipaddress

    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "ferry-mailer-test-ca")])
    now = datetime.now(UTC)
    ca_ski = x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key())
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(ca_ski, critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_subject_key_identifier(ca_ski),
            critical=False,
        )
        .sign(ca_key, hashes.SHA256())
    )

    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "127.0.0.1")])
    server_cert = (
        x509.CertificateBuilder()
        .subject_name(server_name)
        .issuer_name(ca_name)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(
            x509.SubjectAlternativeName([x509.IPAddress(ipaddress.IPv4Address("127.0.0.1"))]),
            critical=False,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                key_cert_sign=False,
                crl_sign=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]),
            critical=False,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(server_key.public_key()), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_subject_key_identifier(ca_ski),
            critical=False,
        )
        .sign(ca_key, hashes.SHA256())
    )

    ca_path = tmp_path / "ca.pem"
    cert_path = tmp_path / "server.pem"
    key_path = tmp_path / "server.key"
    ca_path.write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    cert_path.write_bytes(server_cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    return ca_path, cert_path, key_path


def test_starttls_end_to_end_with_aiosmtpd(monkeypatch, tmp_path: Path) -> None:
    aiosmtpd = pytest.importorskip("aiosmtpd")
    import socket

    from aiosmtpd.controller import Controller
    from aiosmtpd.smtp import AuthResult, LoginPassword

    ca_path, cert_path, key_path = _make_localhost_tls_material(tmp_path)
    received: list[bytes] = []

    class RecordingHandler:
        async def handle_DATA(self, server, session, envelope):  # noqa: N802
            received.append(envelope.content)
            return "250 Message accepted"

    def authenticator(_server, _session, _envelope, _mechanism, auth_data):
        if isinstance(auth_data, LoginPassword) and auth_data.login == b"resend" and auth_data.password == b"secret":
            return AuthResult(success=True)
        return AuthResult(success=False, handled=True)

    server_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_ctx.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))

    # aiosmtpd refuse port=0 (probe de readiness) : reserver un port libre.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]

    controller = Controller(
        RecordingHandler(),
        hostname="127.0.0.1",
        port=port,
        tls_context=server_ctx,
        require_starttls=True,
        authenticator=authenticator,
        auth_required=True,
        auth_require_tls=True,
    )
    controller.start()
    try:
        assert controller.port == port

        real_create_default_context = ssl.create_default_context

        def client_context():
            ctx = real_create_default_context()
            ctx.load_verify_locations(cafile=str(ca_path))
            return ctx

        monkeypatch.setattr(mailer.ssl, "create_default_context", client_context)
        _configure_smtp(
            monkeypatch,
            SMTP_HOST="127.0.0.1",
            SMTP_PORT=str(port),
            SMTP_USER="resend",
            SMTP_PASSWORD="secret",
            SMTP_SECURITY="starttls",
            SMTP_FROM="send@ferry-agent.test",
            SMTP_REPLY_TO="owner@example.com",
        )

        epub = tmp_path / "roman.epub"
        payload = b"PK\x03\x04ebook-body"
        epub.write_bytes(payload)

        mailer._send_sync(str(epub), "roman.epub", "reader@kindle.com", kindle=False)

        deadline = time.time() + 5
        while not received and time.time() < deadline:
            time.sleep(0.05)
        assert received, "aucun message recu par aiosmtpd"

        msg = email.message_from_bytes(received[0], policy=policy.default)
        assert msg["From"] == "send@ferry-agent.test"
        assert msg["To"] == "reader@kindle.com"
        assert msg["Subject"] == "Ferry Agent : roman.epub"
        assert msg["Message-ID"]
        assert msg["Date"]
        assert msg["Reply-To"] == "owner@example.com"

        attachments = [p for p in msg.iter_attachments()]
        assert len(attachments) == 1
        assert attachments[0].get_filename() == "roman.epub"
        assert attachments[0].get_content() == payload
    finally:
        controller.stop()

    # Evite un faux positif si l'import aiosmtpd echoue silencieusement.
    assert aiosmtpd is not None


def test_is_transient_error_classification() -> None:
    assert mailer.is_transient_error(smtplib.SMTPResponseException(421, b"try later")) is True
    assert mailer.is_transient_error(smtplib.SMTPResponseException(550, b"no such user")) is False
    assert mailer.is_transient_error(smtplib.SMTPServerDisconnected("bye")) is True
    assert mailer.is_transient_error(mailer.MessageTooLargeForRelay("too big")) is False
    assert mailer.is_transient_error(mailer.MailerNotConfigured("no smtp")) is False


def test_idempotency_header_stable_across_builds(monkeypatch, tmp_path: Path) -> None:
    epub = tmp_path / "livre.epub"
    epub.write_bytes(b"PK\x03\x04same-bytes")
    _configure_smtp(
        monkeypatch,
        SMTP_FROM="send@ferry-agent.test",
        SMTP_IDEMPOTENCY_HEADER="Resend-Idempotency-Key",
    )

    msg1 = mailer.build_message(str(epub), "livre.epub", "reader@kindle.com", kindle=True)
    msg2 = mailer.build_message(str(epub), "livre.epub", "reader@kindle.com", kindle=True)

    key1 = msg1["Resend-Idempotency-Key"]
    key2 = msg2["Resend-Idempotency-Key"]
    assert key1
    assert key1 == key2
    assert len(key1) == 32


def test_send_sync_returns_acceptance_trace_with_message_id(monkeypatch, tmp_path: Path) -> None:
    epub = tmp_path / "x.epub"
    epub.write_bytes(b"PK\x03\x04fake-epub")
    captured: dict = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            captured["host"], captured["port"] = host, port

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def ehlo(self):
            return (250, b"ok")

        def starttls(self, *, context=None):
            return None

        def login(self, user, password):
            return None

        def send_message(self, message):
            captured["message"] = message
            return {}

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    _configure_smtp(monkeypatch)

    result = mailer._send_sync(str(epub), "x.epub", "reader@kindle.com", kindle=True)

    message_id = captured["message"]["Message-ID"]
    assert message_id
    assert result == f"smtp.test:587 accepted {message_id}"
    assert message_id in result
