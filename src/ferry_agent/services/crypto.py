"""Chiffrement au repos (Fernet) et etats OAuth signes pour la liaison cloud.

`FERNET_KEY` (Settings) accepte une ou plusieurs cles separees par des
virgules. La premiere chiffre ; `MultiFernet` permet la rotation en gardant
les anciennes cles en lecture.

Perdre toutes les cles rend les `Device.link_ref` illisibles : l'API expose
alors `cloud_linked=false` (jamais une 500) et invite a relier le compte.
"""

from __future__ import annotations

import json
import logging
import secrets
import threading
import time
import uuid
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from ferry_agent.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_OAUTH_STATE_TTL_SECONDS = 600


class CryptoError(Exception):
    """Echec de chiffrement/dechiffrement ou cle absente."""


@dataclass(frozen=True)
class _PendingOAuth:
    device_id: uuid.UUID
    provider: str
    expires_at: float
    locale: str = "fr"


@dataclass(frozen=True)
class OAuthStateInfo:
    """Résultat de `consume_oauth_state` : provider + locale UI pour le redirect."""

    provider: str
    locale: str


_pending_lock = threading.Lock()
_pending_nonces: dict[str, _PendingOAuth] = {}

_ALLOWED_LOCALES = frozenset({"fr", "en"})


def normalize_oauth_locale(locale: str | None) -> str:
    """Locale UI pour le redirect post-OAuth ; défaut `fr` si inconnue."""
    if locale in _ALLOWED_LOCALES:
        return locale
    return "fr"


def _parse_keys(raw: str | None) -> list[bytes]:
    if not raw:
        return []
    return [part.strip().encode("ascii") for part in raw.split(",") if part.strip()]


def _multi_fernet() -> MultiFernet | None:
    keys = _parse_keys(get_settings().fernet_key)
    if not keys:
        return None
    return MultiFernet([Fernet(key) for key in keys])


def encrypt(plaintext: str) -> str:
    """Chiffre `plaintext` avec la premiere cle FERNET_KEY."""
    fernet = _multi_fernet()
    if fernet is None:
        raise CryptoError("FERNET_KEY manquante : impossible de chiffrer")
    return fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    """Dechiffre un jeton Fernet (tente toutes les cles configurees)."""
    fernet = _multi_fernet()
    if fernet is None:
        raise CryptoError("FERNET_KEY manquante : impossible de dechiffrer")
    try:
        return fernet.decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError) as exc:
        raise CryptoError("jeton Fernet invalide ou cle incorrecte") from exc


def clear_oauth_states() -> None:
    """Vide le store d'etats OAuth (tests)."""
    with _pending_lock:
        _pending_nonces.clear()


def _purge_expired_locked(now: float) -> None:
    expired = [nonce for nonce, pending in _pending_nonces.items() if pending.expires_at <= now]
    for nonce in expired:
        del _pending_nonces[nonce]


def issue_oauth_state(
    device_id: uuid.UUID,
    provider: str,
    *,
    locale: str | None = None,
    ttl_seconds: int | None = None,
) -> str:
    """Cree un `state` OAuth signe (Fernet) et enregistre le nonce cote serveur."""
    settings = get_settings()
    ttl = ttl_seconds if ttl_seconds is not None else settings.oauth_state_ttl_seconds
    nonce = secrets.token_urlsafe(32)
    expires_at = time.time() + max(1, ttl)
    ui_locale = normalize_oauth_locale(locale)
    payload = {
        "nonce": nonce,
        "device_id": str(device_id),
        "provider": provider,
        "locale": ui_locale,
        "exp": expires_at,
    }
    try:
        state = encrypt(json.dumps(payload, separators=(",", ":")))
    except CryptoError:
        raise

    with _pending_lock:
        _purge_expired_locked(time.time())
        _pending_nonces[nonce] = _PendingOAuth(
            device_id=device_id, provider=provider, expires_at=expires_at, locale=ui_locale
        )
    return state


def consume_oauth_state(state: str, device_id: uuid.UUID) -> OAuthStateInfo:
    """Valide et consomme un `state` (usage unique). Retourne provider + locale.

    Leve `CryptoError` si le state est absent, expire, rejoue, ou ne
    correspond pas au `device_id` de l'URL.
    """
    if not state:
        raise CryptoError("state OAuth manquant")

    try:
        payload = json.loads(decrypt(state))
    except (CryptoError, json.JSONDecodeError, TypeError) as exc:
        raise CryptoError("state OAuth invalide") from exc

    nonce = payload.get("nonce")
    provider = payload.get("provider")
    exp = payload.get("exp")
    state_device_id = payload.get("device_id")
    locale = normalize_oauth_locale(payload.get("locale") if isinstance(payload.get("locale"), str) else None)
    if not isinstance(nonce, str) or not isinstance(provider, str) or not isinstance(exp, (int, float)):
        raise CryptoError("state OAuth invalide")
    if state_device_id != str(device_id):
        raise CryptoError("state OAuth ne correspond pas au device")
    if time.time() > float(exp):
        raise CryptoError("state OAuth expire")

    with _pending_lock:
        _purge_expired_locked(time.time())
        pending = _pending_nonces.pop(nonce, None)

    if pending is None:
        raise CryptoError("state OAuth inconnu ou deja utilise")
    if pending.device_id != device_id or pending.provider != provider:
        raise CryptoError("state OAuth incoherent")
    if pending.expires_at <= time.time():
        raise CryptoError("state OAuth expire")

    return OAuthStateInfo(provider=provider, locale=pending.locale or locale)
