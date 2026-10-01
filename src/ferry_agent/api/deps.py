"""Dependance d'authentification (Clerk JWT, assertion MCP, avec mode dev).

En production, `CLERK_ISSUER` doit etre renseigne : chaque requete sur
`/api/v1/*` doit porter un `Authorization: Bearer <jwt>` signe par Clerk
(RS256), verifie via les cles JWKS recuperees au lifespan de l'app et mises
en cache dans `app.state.jwks_client`.

Le serveur MCP peut presenter une assertion Ed25519 courte (`iss=ferry-agent-mcp`,
`aud=ferry-core`) au lieu du jeton Clerk amont. Cette voie n'est active que si
`MCP_ASSERTION_PUBLIC_KEY_B64` est configuree ; elle ne remplace pas la voie
Clerk utilisee par le web.

Si `CLERK_ISSUER` est absent (developpement local uniquement), la
dependance retombe sur le header `X-Dev-User: <email>` : aucune verification
cryptographique n'est effectuee. Ce mode ne doit JAMAIS etre active en
production (voir README et .env.example).
"""

import base64
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
from ferry_agent.services.sources import ensure_default_sources

logger = logging.getLogger(__name__)

_MCP_ASSERTION_ISSUER = "ferry-agent-mcp"
_MCP_ASSERTION_AUDIENCE = "ferry-core"
_MCP_ASSERTION_MAX_TTL_SECONDS = 300


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
        await db.flush()
        await ensure_default_sources(db, user.id)
        await db.refresh(user)
    return user


def _load_mcp_assertion_public_key(public_key_b64: str) -> bytes | None:
    """Decode la cle publique PEM (base64 une ligne). None si absente/invalide."""
    raw = (public_key_b64 or "").strip()
    if not raw:
        return None
    try:
        return base64.b64decode(raw, validate=True)
    except Exception:
        logger.warning("MCP_ASSERTION_PUBLIC_KEY_B64 illisible — voie assertion ignoree")
        return None


def _verify_mcp_assertion(token: str) -> str | None:
    """Verifie une assertion MCP Ed25519. Retourne l'email, ou None si refusee.

    Ne leve jamais d'exception vers l'appelant HTTP : une cle absente ou un
    jeton invalide se traduit par un refus (None) → 401 plus haut, pas un 500.
    """
    settings = get_settings()
    public_pem = _load_mcp_assertion_public_key(
        getattr(settings, "mcp_assertion_public_key_b64", None) or ""
    )
    if public_pem is None:
        return None

    try:
        payload = jwt.decode(
            token,
            public_pem,
            algorithms=["EdDSA"],
            audience=_MCP_ASSERTION_AUDIENCE,
            issuer=_MCP_ASSERTION_ISSUER,
            options={"verify_aud": True, "verify_iss": True},
        )
    except jwt.PyJWTError:
        return None

    if not isinstance(payload, dict):
        return None

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        return None

    email = payload.get("email")
    if not isinstance(email, str) or not email.strip():
        return None

    iat = payload.get("iat")
    exp = payload.get("exp")
    if not isinstance(iat, int) or not isinstance(exp, int):
        return None
    if exp - iat > _MCP_ASSERTION_MAX_TTL_SECONDS:
        return None

    return email.strip()


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
    clerk_error: HTTPException | None = None

    # Voie Clerk (web) — logique inchangee ; en cas d'echec on tente l'assertion MCP.
    if jwks_client is not None:
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
        except HTTPException as exc:
            if exc.status_code != status.HTTP_401_UNAUTHORIZED:
                raise
            clerk_error = exc
        except jwt.PyJWTError as exc:
            clerk_error = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"JWT invalide: {exc}",
            )
    elif not (getattr(settings, "mcp_assertion_public_key_b64", None) or "").strip():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWKS non initialise")

    assertion_email = _verify_mcp_assertion(token)
    if assertion_email:
        user = await _get_or_create_user(db, assertion_email)
        return CurrentUser(id=user.id, email=user.email)

    if clerk_error is not None:
        raise clerk_error
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT invalide")


async def get_gateway(
    x_gateway_key: str | None = Header(default=None, alias="X-Gateway-Key"),
    db: AsyncSession = Depends(get_db),
) -> Gateway:
    """Authentifie un agent avec sa cle dediee et actualise sa presence.

    Utilise par le canal gateway (`poll`, `search-results`, `fetch-result`)
    et par l'import bibliotheque au nom de l'utilisateur proprio
    (`POST /api/v1/books/upload` via `get_library_user`).
    """
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


async def get_library_user(
    request: Request,
    authorization: str | None = Header(default=None),
    x_dev_user: str | None = Header(default=None, alias="X-Dev-User"),
    x_gateway_key: str | None = Header(default=None, alias="X-Gateway-Key"),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """Utilisateur bibliotheque : session Clerk/dev, ou proprio via cle gateway.

    Permet a l'agent (dossier surveille) d'importer au nom de l'utilisateur
    sans JWT Clerk, tout en gardant l'upload navigateur via Bearer/dev.
    """
    if x_gateway_key:
        gateway = await get_gateway(x_gateway_key=x_gateway_key, db=db)
        result = await db.execute(select(User).where(User.id == gateway.user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="utilisateur gateway introuvable",
            )
        return CurrentUser(id=user.id, email=user.email)
    return await get_current_user(
        request, authorization=authorization, x_dev_user=x_dev_user, db=db
    )
