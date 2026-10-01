"""Jetons de telechargement signes (Fernet) pour clients sans stream binaire.

Le jeton porte `purpose=download` pour ne jamais confondre avec un state
OAuth. Fernet produit du base64 urlsafe : le jeton reste utilisable dans un
chemin d'URL (`/api/v1/downloads/<token>`).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from ferry_agent.services import crypto


class DownloadLinkError(Exception):
    """Jeton de telechargement invalide, expire, ou a un purpose etranger."""


@dataclass(frozen=True)
class DownloadLinkInfo:
    """Payload consomme d'un jeton de telechargement."""

    user_id: uuid.UUID
    item_id: uuid.UUID
    format: str
    expires_at: datetime


_PURPOSE = "download"


def issue_download_token(
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    fmt: str,
    ttl_seconds: int,
) -> tuple[str, datetime]:
    """Emmet un jeton signe ; retourne `(token, expires_at)` en UTC."""
    ttl = max(1, int(ttl_seconds))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
    payload = {
        "purpose": _PURPOSE,
        "user_id": str(user_id),
        "item_id": str(item_id),
        "format": fmt.lower().lstrip("."),
        "exp": expires_at.timestamp(),
    }
    try:
        token = crypto.encrypt(json.dumps(payload, separators=(",", ":")))
    except crypto.CryptoError as exc:
        raise DownloadLinkError("impossible d'emettre le jeton de telechargement") from exc
    return token, expires_at


def consume_download_token(token: str) -> DownloadLinkInfo:
    """Valide et decode un jeton. Leve `DownloadLinkError` si invalide/expire."""
    if not token:
        raise DownloadLinkError("jeton manquant")

    try:
        raw = crypto.decrypt(token)
        payload = json.loads(raw)
    except (crypto.CryptoError, json.JSONDecodeError, TypeError) as exc:
        raise DownloadLinkError("jeton invalide") from exc

    if not isinstance(payload, dict):
        raise DownloadLinkError("jeton invalide")

    purpose = payload.get("purpose")
    if purpose != _PURPOSE:
        raise DownloadLinkError("purpose etranger")

    user_raw = payload.get("user_id")
    item_raw = payload.get("item_id")
    fmt = payload.get("format")
    exp = payload.get("exp")
    if (
        not isinstance(user_raw, str)
        or not isinstance(item_raw, str)
        or not isinstance(fmt, str)
        or not isinstance(exp, (int, float))
    ):
        raise DownloadLinkError("jeton invalide")

    expires_at = datetime.fromtimestamp(float(exp), tz=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise DownloadLinkError("jeton expire")

    try:
        user_id = uuid.UUID(user_raw)
        item_id = uuid.UUID(item_raw)
    except ValueError as exc:
        raise DownloadLinkError("jeton invalide") from exc

    return DownloadLinkInfo(
        user_id=user_id,
        item_id=item_id,
        format=fmt.lower().lstrip("."),
        expires_at=expires_at,
    )
