"""Tests d'auth JWT Clerk (get_current_user) sans reseau ni PostgreSQL.

Cles RS256 generees en memoire ; JWKS et settings mockes.
"""

from __future__ import annotations

import time
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from ferry_agent.api import deps
from ferry_agent.models import User

from tests.fakes import FakeSession

CLERK_ISSUER = "https://clerk.example.test"
FAKE_AUD = "https://frontend.example.test"


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


def _make_token(private_pem: bytes, *, iss: str, aud: str | None = None, email: str = "u@example.test") -> str:
    now = int(time.time())
    payload: dict = {
        "sub": "user_test",
        "email": email,
        "iss": iss,
        "iat": now,
        "exp": now + 3600,
        "nbf": now,
    }
    if aud is not None:
        payload["aud"] = aud
    return jwt.encode(payload, private_pem, algorithm="RS256")


class _FakeSigningKey:
    def __init__(self, public_pem: bytes) -> None:
        self.key = public_pem


class _FakeJwksClient:
    def __init__(self, public_pem: bytes) -> None:
        self._public_pem = public_pem

    def get_signing_key_from_jwt(self, _token: str) -> _FakeSigningKey:
        return _FakeSigningKey(self._public_pem)


class _FakeRequest:
    def __init__(self, jwks_client) -> None:
        self.app = SimpleNamespace(state=SimpleNamespace(jwks_client=jwks_client))


def _settings(*, issuer: str = CLERK_ISSUER, audience: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        clerk_issuer=issuer,
        clerk_audience=audience,
        mcp_api_key=None,
        mcp_service_user_email="mcp@test",
    )


async def _call_get_current_user(
    monkeypatch: pytest.MonkeyPatch,
    *,
    token: str,
    public_pem: bytes,
    issuer: str = CLERK_ISSUER,
    audience: str | None = None,
):
    monkeypatch.setattr(deps, "get_settings", lambda: _settings(issuer=issuer, audience=audience))
    user = User(id=uuid.uuid4(), email="u@example.test")
    return await deps.get_current_user(
        request=_FakeRequest(_FakeJwksClient(public_pem)),
        authorization=f"Bearer {token}",
        x_dev_user=None,
        x_api_key=None,
        db=FakeSession(always=user),
    )


async def test_empty_audience_skips_aud_check(monkeypatch: pytest.MonkeyPatch, rsa_keys) -> None:
    """CLERK_AUDIENCE="" (ou None) : pas de verify_aud, token avec aud frontend accepte."""
    private_pem, public_pem = rsa_keys
    token = _make_token(private_pem, iss=CLERK_ISSUER, aud=FAKE_AUD)

    current = await _call_get_current_user(
        monkeypatch, token=token, public_pem=public_pem, audience=""
    )
    assert current.email == "u@example.test"

    current_none = await _call_get_current_user(
        monkeypatch, token=token, public_pem=public_pem, audience=None
    )
    assert current_none.email == "u@example.test"


async def test_nonempty_audience_is_verified(monkeypatch: pytest.MonkeyPatch, rsa_keys) -> None:
    private_pem, public_pem = rsa_keys
    good = _make_token(private_pem, iss=CLERK_ISSUER, aud=FAKE_AUD)
    bad = _make_token(private_pem, iss=CLERK_ISSUER, aud="https://wrong.example")

    current = await _call_get_current_user(
        monkeypatch, token=good, public_pem=public_pem, audience=FAKE_AUD
    )
    assert current.email == "u@example.test"

    with pytest.raises(HTTPException) as exc:
        await _call_get_current_user(
            monkeypatch, token=bad, public_pem=public_pem, audience=FAKE_AUD
        )
    assert exc.value.status_code == 401
    assert "JWT invalide" in exc.value.detail


async def test_issuer_trailing_slash_accepted(monkeypatch: pytest.MonkeyPatch, rsa_keys) -> None:
    """Issuer settings avec slash final, claim iss sans (et inverse)."""
    private_pem, public_pem = rsa_keys

    token_no_slash = _make_token(private_pem, iss=CLERK_ISSUER, aud=None)
    current = await _call_get_current_user(
        monkeypatch,
        token=token_no_slash,
        public_pem=public_pem,
        issuer=CLERK_ISSUER + "/",
        audience="",
    )
    assert current.email == "u@example.test"

    token_with_slash = _make_token(private_pem, iss=CLERK_ISSUER + "/", aud=None)
    current2 = await _call_get_current_user(
        monkeypatch,
        token=token_with_slash,
        public_pem=public_pem,
        issuer=CLERK_ISSUER,
        audience="",
    )
    assert current2.email == "u@example.test"


async def test_different_issuer_rejected(monkeypatch: pytest.MonkeyPatch, rsa_keys) -> None:
    private_pem, public_pem = rsa_keys
    token = _make_token(private_pem, iss="https://evil.example.test", aud=None)

    with pytest.raises(HTTPException) as exc:
        await _call_get_current_user(
            monkeypatch, token=token, public_pem=public_pem, issuer=CLERK_ISSUER, audience=""
        )
    assert exc.value.status_code == 401
    assert "issuer" in exc.value.detail.lower()
