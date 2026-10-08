"""Tests de la voie assertion MCP (Ed25519) dans get_current_user."""

from __future__ import annotations

import base64
import time
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519, rsa
from fastapi import HTTPException

from ferry_agent.api import deps
from ferry_agent.models import User

from tests.fakes import FakeSession
from tests.test_deps_auth import (
    CLERK_ISSUER,
    _FakeJwksClient,
    _FakeRequest,
    _make_token,
)


@pytest.fixture(scope="module")
def rsa_keys():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem

ASSERTION_ISS = "ferry-agent-mcp"
ASSERTION_AUD = "ferry-core"


@pytest.fixture
def ed25519_keys():
    private_key = ed25519.Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


def _b64(pem: bytes) -> str:
    return base64.b64encode(pem).decode("ascii")


def _make_assertion(
    private_pem: bytes,
    *,
    iss: str = ASSERTION_ISS,
    aud: str = ASSERTION_AUD,
    sub: str | None = "user_clerk_sub",
    email: str | None = "u@example.test",
    ttl: int = 120,
    expired: bool = False,
) -> str:
    now = int(time.time())
    iat = now - 400 if expired else now
    exp = iat + ttl
    payload: dict = {
        "iss": iss,
        "aud": aud,
        "iat": iat,
        "exp": exp,
        "jti": "test-jti",
    }
    if sub is not None:
        payload["sub"] = sub
    if email is not None:
        payload["email"] = email
    return jwt.encode(payload, private_pem, algorithm="EdDSA")


def _settings_with_assertion(
    *,
    public_key_b64: str | None,
    issuer: str = CLERK_ISSUER,
    audience: str | None = "",
) -> SimpleNamespace:
    return SimpleNamespace(
        clerk_issuer=issuer,
        clerk_audience=audience,
        mcp_assertion_public_key_b64=public_key_b64,
    )


async def _call_with_assertion(
    monkeypatch: pytest.MonkeyPatch,
    *,
    token: str,
    public_pem: bytes | None,
    rsa_public_pem: bytes,
):
    b64 = _b64(public_pem) if public_pem is not None else None
    monkeypatch.setattr(
        deps,
        "get_settings",
        lambda: _settings_with_assertion(public_key_b64=b64),
    )
    user = User(id=uuid.uuid4(), email="u@example.test")
    return await deps.get_current_user(
        request=_FakeRequest(_FakeJwksClient(rsa_public_pem)),
        authorization=f"Bearer {token}",
        x_dev_user=None,
        db=FakeSession(always=user),
    )


async def test_valid_mcp_assertion_accepted(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem)

    current = await _call_with_assertion(
        monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
    )
    assert current.email == "u@example.test"


async def test_valid_mcp_assertion_without_email_accepted(monkeypatch, ed25519_keys, rsa_keys):
    private, public = ed25519_keys
    _, rsa_public = rsa_keys
    current = await _call_with_assertion(monkeypatch, token=_make_assertion(private, email=None),
                                         public_pem=public, rsa_public_pem=rsa_public)
    assert current.email == "u@example.test"


async def test_wrong_audience_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem, aud="wrong-aud")

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_wrong_issuer_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem, iss="evil-mcp")

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_wrong_signature_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, _ = ed25519_keys
    other = ed25519.Ed25519PrivateKey.generate()
    other_pub = other.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem)

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=other_pub, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_expired_assertion_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem, expired=True, ttl=120)

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_ttl_over_300s_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem, ttl=301)

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_truncated_token_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem)[:-8]

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_missing_sub_rejected(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, public_pem = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem, sub=None)

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=public_pem, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_public_key_absent_assertion_returns_401_not_500(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    private_pem, _ = ed25519_keys
    _, rsa_public = rsa_keys
    token = _make_assertion(private_pem)

    with pytest.raises(HTTPException) as exc:
        await _call_with_assertion(
            monkeypatch, token=token, public_pem=None, rsa_public_pem=rsa_public
        )
    assert exc.value.status_code == 401


async def test_clerk_path_still_works_with_assertion_configured(
    monkeypatch: pytest.MonkeyPatch, ed25519_keys, rsa_keys
) -> None:
    """Voie Clerk inchangee meme si la cle publique assertion est presente."""
    _, public_pem = ed25519_keys
    private_rsa, public_rsa = rsa_keys
    clerk_token = _make_token(private_rsa, iss=CLERK_ISSUER, aud=None)

    monkeypatch.setattr(
        deps,
        "get_settings",
        lambda: _settings_with_assertion(public_key_b64=_b64(public_pem), audience=""),
    )
    user = User(id=uuid.uuid4(), email="u@example.test")
    current = await deps.get_current_user(
        request=_FakeRequest(_FakeJwksClient(public_rsa)),
        authorization=f"Bearer {clerk_token}",
        x_dev_user=None,
        db=FakeSession(always=user),
    )
    assert current.email == "u@example.test"


async def test_verify_mcp_assertion_unit_helpers(ed25519_keys) -> None:
    private_pem, public_pem = ed25519_keys
    token = _make_assertion(private_pem)

    # Simule settings via monkeypatch local sur la fonction helper.
    class _S:
        mcp_assertion_public_key_b64 = _b64(public_pem)

    original = deps.get_settings
    deps.get_settings = lambda: _S()  # type: ignore[assignment]
    try:
        assert deps._verify_mcp_assertion(token) == ("user_clerk_sub", "u@example.test")
        assert deps._verify_mcp_assertion(_make_assertion(private_pem, email=None)) == (
            "user_clerk_sub", None
        )
        assert deps._verify_mcp_assertion(token[:-4]) is None
        assert deps._verify_mcp_assertion(_make_assertion(private_pem, sub=None)) is None
        assert deps._verify_mcp_assertion(_make_assertion(private_pem, ttl=400)) is None
    finally:
        deps.get_settings = original  # type: ignore[assignment]
