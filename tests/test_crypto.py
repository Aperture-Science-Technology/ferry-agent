"""Tests du wrapper Fernet (chiffrement + rotation MultiFernet + state OAuth)."""

import json
import uuid

import pytest
from cryptography.fernet import Fernet

from ferry_agent.services import crypto


@pytest.fixture(autouse=True)
def _reset_oauth_states():
    crypto.clear_oauth_states()
    yield
    crypto.clear_oauth_states()


def test_encrypt_decrypt_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(crypto, "get_settings", lambda: type("S", (), {"fernet_key": key})())
    token = crypto.encrypt("hello-secret")
    assert token != "hello-secret"
    assert not token.startswith("{")
    assert crypto.decrypt(token) == "hello-secret"


def test_key_rotation_with_two_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    key_old = Fernet.generate_key().decode()
    key_new = Fernet.generate_key().decode()

    monkeypatch.setattr(crypto, "get_settings", lambda: type("S", (), {"fernet_key": key_old})())
    token = crypto.encrypt(json.dumps({"provider": "dropbox", "token": "tok"}))

    # Rotation : nouvelle cle en tete, ancienne conservee pour la lecture.
    monkeypatch.setattr(
        crypto, "get_settings", lambda: type("S", (), {"fernet_key": f"{key_new},{key_old}"})()
    )
    assert json.loads(crypto.decrypt(token)) == {"provider": "dropbox", "token": "tok"}

    new_token = crypto.encrypt("written-with-new-key")
    assert crypto.decrypt(new_token) == "written-with-new-key"

    # L'ancienne cle seule ne lit plus les nouveaux jetons.
    monkeypatch.setattr(crypto, "get_settings", lambda: type("S", (), {"fernet_key": key_old})())
    with pytest.raises(crypto.CryptoError):
        crypto.decrypt(new_token)


def test_decrypt_without_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(crypto, "get_settings", lambda: type("S", (), {"fernet_key": None})())
    with pytest.raises(crypto.CryptoError):
        crypto.encrypt("x")
    with pytest.raises(crypto.CryptoError):
        crypto.decrypt("gAAAAAnot-a-real-token")


def test_oauth_state_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(
        crypto,
        "get_settings",
        lambda: type("S", (), {"fernet_key": key, "oauth_state_ttl_seconds": 600})(),
    )
    device_id = uuid.uuid4()
    state = crypto.issue_oauth_state(device_id, "drive")
    assert crypto.consume_oauth_state(state, device_id) == "drive"
    # Usage unique
    with pytest.raises(crypto.CryptoError):
        crypto.consume_oauth_state(state, device_id)


def test_oauth_state_rejects_wrong_device(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(
        crypto,
        "get_settings",
        lambda: type("S", (), {"fernet_key": key, "oauth_state_ttl_seconds": 600})(),
    )
    device_id = uuid.uuid4()
    state = crypto.issue_oauth_state(device_id, "dropbox")
    with pytest.raises(crypto.CryptoError):
        crypto.consume_oauth_state(state, uuid.uuid4())


def test_oauth_state_rejects_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(
        crypto,
        "get_settings",
        lambda: type("S", (), {"fernet_key": key, "oauth_state_ttl_seconds": 600})(),
    )
    with pytest.raises(crypto.CryptoError):
        crypto.consume_oauth_state("", uuid.uuid4())
