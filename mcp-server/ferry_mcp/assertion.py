"""Forge d'assertions d'identité MCP → cœur (Ed25519 / EdDSA).

Le serveur MCP valide l'OAuth Clerk amont, puis signe une assertion courte
destinée au cœur (`aud=ferry-core`). La clé privée reste côté MCP uniquement.
"""

from __future__ import annotations

import base64
import secrets
import time
from typing import Any

import jwt

ASSERTION_ISSUER = "ferry-agent-mcp"
ASSERTION_AUDIENCE = "ferry-core"
ASSERTION_TTL_SECONDS = 120
ASSERTION_MAX_TTL_SECONDS = 300


def load_private_key_pem(private_key_b64: str) -> bytes:
    """Décode une clé privée PEM fournie en base64 sur une ligne."""
    raw = (private_key_b64 or "").strip()
    if not raw:
        raise ValueError("clé privée d'assertion vide")
    try:
        return base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise ValueError(
            "MCP_CORE_ASSERTION_PRIVATE_KEY_B64 invalide : "
            "attendu un PEM Ed25519 encodé en base64 sur une ligne"
        ) from exc


def forge_core_assertion(*, claims: dict[str, Any], subject: str | None, private_key_b64: str) -> str:
    """Signe une assertion courte pour le cœur à partir des claims OAuth vérifiés.

    Raises:
        RuntimeError: identité incomplète (email ou sub manquant) — ne signe jamais.
        ValueError: clé privée absente ou illisible.
    """
    email = (claims or {}).get("email")
    if not isinstance(email, str) or not email.strip():
        raise RuntimeError(
            "Identité OAuth incomplète : email manquant après introspection/userinfo. "
            "Reconnectez-vous avec le scope `email`, puis réessayez. "
            "Aucune assertion n'a été émise."
        )
    sub = (claims or {}).get("sub") or subject
    if not isinstance(sub, str) or not sub.strip():
        raise RuntimeError(
            "Identité OAuth incomplète : sub manquant. "
            "Reconnectez-vous, puis réessayez. Aucune assertion n'a été émise."
        )

    private_pem = load_private_key_pem(private_key_b64)
    now = int(time.time())
    payload = {
        "iss": ASSERTION_ISSUER,
        "aud": ASSERTION_AUDIENCE,
        "sub": sub.strip(),
        "email": email.strip(),
        "iat": now,
        "exp": now + ASSERTION_TTL_SECONDS,
        "jti": secrets.token_urlsafe(16),
    }
    if ASSERTION_TTL_SECONDS > ASSERTION_MAX_TTL_SECONDS:
        raise RuntimeError("TTL d'assertion interne invalide (> 300 s)")

    return jwt.encode(payload, private_pem, algorithm="EdDSA")
