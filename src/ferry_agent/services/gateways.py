"""Peering et orchestration des jobs executes par les gateways detaches."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import case, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import hash_secret
from ferry_agent.config import get_settings
from ferry_agent.models import (
    Gateway,
    GatewayJob,
    GatewayJobStatus,
    GatewayJobType,
    PairingStatus,
)
from ferry_agent.schemas import Result
from ferry_agent.services.covers import validate_cover_url


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_gateway(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    ttl_minutes: int,
) -> tuple[Gateway, str, str]:
    pairing_token = secrets.token_urlsafe(32)
    gateway_key = secrets.token_urlsafe(48)
    gateway = Gateway(
        user_id=user_id,
        name=name,
        pairing_status=PairingStatus.pending,
        api_key_hash=hash_secret(gateway_key),
        pairing_token_hash=hash_secret(pairing_token),
        pairing_expires_at=utcnow() + timedelta(minutes=ttl_minutes),
        pairing_used=False,
    )
    db.add(gateway)
    await db.commit()
    await db.refresh(gateway)
    return gateway, pairing_token, gateway_key


async def recreate_gateway_credentials(
    db: AsyncSession,
    gateway: Gateway,
    ttl_minutes: int,
) -> tuple[Gateway, str, str]:
    """Regenere les deux secrets pour un acces non encore connecte (ou revoque).

    Les codes ne sont affiches qu'une fois a la creation : apres expiration ou
    perte, l'utilisateur doit pouvoir repartir sans supprimer l'acces. Un acces
    deja ``paired`` doit d'abord etre revoque.
    """
    if gateway.pairing_status == PairingStatus.paired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="acces deja connecte — revoquez-le avant de recreer les codes",
        )

    pairing_token = secrets.token_urlsafe(32)
    gateway_key = secrets.token_urlsafe(48)
    gateway.api_key_hash = hash_secret(gateway_key)
    gateway.pairing_token_hash = hash_secret(pairing_token)
    gateway.pairing_expires_at = utcnow() + timedelta(minutes=ttl_minutes)
    gateway.pairing_used = False
    gateway.pairing_status = PairingStatus.pending
    gateway.last_seen_at = None
    await db.commit()
    await db.refresh(gateway)
    return gateway, pairing_token, gateway_key


async def pair_gateway(db: AsyncSession, token: str) -> Gateway:
    query = (
        select(Gateway)
        .where(Gateway.pairing_token_hash == hash_secret(token))
        .with_for_update()
    )
    result = await db.execute(query)
    gateway = result.scalar_one_or_none()
    now = utcnow()
    if (
        gateway is None
        or gateway.pairing_used
        or gateway.pairing_status != PairingStatus.pending
        or gateway.pairing_expires_at is None
        or gateway.pairing_expires_at <= now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="pairing token invalide, expire ou deja utilise",
        )

    gateway.pairing_used = True
    gateway.pairing_token_hash = None
    gateway.pairing_status = PairingStatus.paired
    gateway.last_seen_at = now
    await db.commit()
    return gateway


async def revoke_gateway(db: AsyncSession, gateway: Gateway) -> None:
    gateway.api_key_hash = None
    gateway.pairing_token_hash = None
    gateway.pairing_used = True
    gateway.pairing_status = PairingStatus.revoked
    await db.execute(
        update(GatewayJob)
        .where(
            GatewayJob.gateway_id == gateway.id,
            GatewayJob.status == GatewayJobStatus.pending,
        )
        .values(status=GatewayJobStatus.failed, result_ref="gateway revoked")
    )
    await db.commit()


async def delete_gateway(db: AsyncSession, gateway: Gateway) -> None:
    """Supprime le gateway ; les `GatewayJob` partent via ON DELETE CASCADE
    (la purge manuelle est devenue redondante depuis 0009)."""
    await db.delete(gateway)
    await db.commit()


async def poll_job(db: AsyncSession, gateway_id: uuid.UUID) -> GatewayJob | None:
    """Retourne d'abord le job running (reprise idempotente), sinon prend un pending.

    Incremente ``attempts`` a chaque poll. Au-dela de
    ``gateway_job_max_attempts``, le job part en dead-letter (``failed``) et on
    re-selectionne le suivant. Sinon pose un backoff exponentiel plafonne a
    ~15 min via ``next_attempt_at``.
    """
    settings = get_settings()
    max_attempts = settings.gateway_job_max_attempts
    base_seconds = settings.gateway_job_backoff_base_seconds
    # Borne : abandonner au plus une file de jobs poison sans boucler a l'infini.
    for _ in range(max_attempts + 2):
        now = utcnow()
        result = await db.execute(
            select(GatewayJob)
            .where(
                GatewayJob.gateway_id == gateway_id,
                GatewayJob.status.in_([GatewayJobStatus.running, GatewayJobStatus.pending]),
                or_(
                    GatewayJob.next_attempt_at.is_(None),
                    GatewayJob.next_attempt_at <= now,
                ),
            )
            .order_by(
                case((GatewayJob.status == GatewayJobStatus.running, 0), else_=1),
                GatewayJob.created_at,
            )
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        job = result.scalar_one_or_none()
        if job is None:
            return None

        job.attempts += 1
        if job.attempts > max_attempts:
            job.status = GatewayJobStatus.failed
            job.result_ref = f"abandonné après {job.attempts} tentatives"
            await db.commit()
            continue

        delay = min(base_seconds * (2 ** (job.attempts - 1)), 15 * 60)
        job.next_attempt_at = now + timedelta(seconds=delay)
        if job.status == GatewayJobStatus.pending:
            job.status = GatewayJobStatus.running
        await db.commit()
        return job
    return None


async def get_gateway_job(
    db: AsyncSession,
    gateway_id: uuid.UUID,
    job_id: uuid.UUID,
    expected_type: GatewayJobType | None = None,
) -> GatewayJob:
    result = await db.execute(
        select(GatewayJob).where(
            GatewayJob.id == job_id,
            GatewayJob.gateway_id == gateway_id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway job introuvable")
    if expected_type is not None and job.type != expected_type:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="type de gateway job incorrect")
    return job


async def save_search_results(
    db: AsyncSession,
    job: GatewayJob,
    results: list[Result],
) -> GatewayJob:
    if job.status == GatewayJobStatus.done:
        return job
    if job.status not in (GatewayJobStatus.pending, GatewayJobStatus.running):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="gateway job non actif")
    sanitized = [
        result.model_copy(update={"cover_url": validate_cover_url(result.cover_url)})
        for result in results
    ]
    job.payload = {
        **job.payload,
        "results": [result.model_dump(mode="json") for result in sanitized],
    }
    job.status = GatewayJobStatus.done
    await db.commit()
    return job


async def online_gateways(
    db: AsyncSession,
    user_id: uuid.UUID,
    online_seconds: int,
) -> list[Gateway]:
    threshold = utcnow() - timedelta(seconds=online_seconds)
    result = await db.execute(
        select(Gateway).where(
            Gateway.user_id == user_id,
            Gateway.pairing_status == PairingStatus.paired,
            Gateway.last_seen_at.is_not(None),
            Gateway.last_seen_at >= threshold,
        )
    )
    return list(result.scalars().all())


async def create_job(
    db: AsyncSession,
    gateway_id: uuid.UUID,
    job_type: GatewayJobType,
    payload: dict,
) -> GatewayJob:
    job = GatewayJob(
        gateway_id=gateway_id,
        type=job_type,
        payload=payload,
        status=GatewayJobStatus.pending,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def purge_finished_jobs(db: AsyncSession, retention_days: int) -> int:
    """Supprime les ``GatewayJob`` termines (``done``/``failed``) trop anciens.

    Les jobs ``running``/``pending`` sont conserves (reprise potentielle).
    """
    cutoff = utcnow() - timedelta(days=retention_days)
    result = await db.execute(
        delete(GatewayJob).where(
            GatewayJob.status.in_([GatewayJobStatus.done, GatewayJobStatus.failed]),
            GatewayJob.updated_at < cutoff,
        )
    )
    await db.commit()
    return int(result.rowcount or 0)
