"""Dependance d'authentification (Clerk JWT, avec mode dev).

En production, `CLERK_ISSUER` doit etre renseigne : chaque requete sur
`/api/v1/*` doit porter un `Authorization: Bearer <jwt>` signe par Clerk
(RS256), verifie via les cles JWKS recuperees au lifespan de l'app et mises
en cache dans `app.state.jwks_client`.

Si `CLERK_ISSUER` est absent (developpement local uniquement), la
dependance retombe sur le header `X-Dev-User: <email>` : aucune verification
cryptographique n'est effectuee. Ce mode ne doit JAMAIS etre active en
production (voir README et .env.example).
"""

import hashlib
import logging
import uuid
from datetime import datetime, timezone

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import Gateway, PairingStatus, User

logger = logging.getLogger(__name__)


class CurrentUser:
    """Utilisateur authentifie courant (id + email)."""

    def __init__(self, id: uuid.UUID, email: str) -> None:
        self.id = id
        self.email = email


def hash_secret(value: str) -> str:
    """Hash deterministe pour rechercher une cle sans la stocker en clair."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def _get_or_create_user(db: AsyncSession, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    x_dev_user: str | None = Header(default=None, alias="X-Dev-User"),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    settings = get_settings()

    if not settings.clerk_issuer:
        # Mode dev : pas de Clerk configure.
        if not x_dev_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="mode dev: en-tete X-Dev-User requis (CLERK_ISSUER non configure)",
            )
        user = await _get_or_create_user(db, x_dev_user)
        return CurrentUser(id=user.id, email=user.email)

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization Bearer requis")

    token = authorization.split(" ", 1)[1].strip()
    jwks_client = getattr(request.app.state, "jwks_client", None)
    if jwks_client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWKS non initialise")

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        # CLERK_AUDIENCE="" (prod actuelle) ne doit PAS activer verify_aud :
        # `is not None` serait True pour "" et comparerait contre audience vide.
        verify_aud = bool(settings.clerk_audience)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=(settings.clerk_audience if settings.clerk_audience else None),
            options={"verify_aud": verify_aud, "verify_iss": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"JWT invalide: {exc}") from exc

    # Clerk peut emettre `iss` avec ou sans slash final : comparer normalise.
    token_iss = (payload.get("iss") or "").rstrip("/")
    expected_iss = (settings.clerk_issuer or "").rstrip("/")
    if not token_iss or token_iss != expected_iss:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT issuer invalide")

    email = payload.get("email") or payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT sans email/sub")

    user = await _get_or_create_user(db, email)
    return CurrentUser(id=user.id, email=user.email)


async def get_gateway(
    x_gateway_key: str | None = Header(default=None, alias="X-Gateway-Key"),
    db: AsyncSession = Depends(get_db),
) -> Gateway:
    """Authentifie un agent avec sa cle dediee et actualise sa presence."""
    if not x_gateway_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="en-tete X-Gateway-Key requis")

    result = await db.execute(
        select(Gateway).where(
            Gateway.api_key_hash == hash_secret(x_gateway_key),
            Gateway.pairing_status == PairingStatus.paired,
        )
    )
    gateway = result.scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="cle gateway invalide")

    gateway.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    return gateway
