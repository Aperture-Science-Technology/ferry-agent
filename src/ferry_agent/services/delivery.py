"""Execution reelle des livraisons vers une liseuse, routee par tier.

`deliver(db, job, ...)` resout `LibraryItem`/`Device`/`User` puis delegue a
l'implementation du tier du device. `run_delivery(job_id, ...)` est le point
d'entree pour `fastapi.BackgroundTasks` : il ouvre sa propre session car la
session de la requete HTTP est deja fermee quand une tache de fond s'execute.

Le fichier envoye/servi est toujours au format exact demande (ou au format
par defaut de l'utilisateur / d'origine si non precise). Aucun fallback
silencieux vers un autre format : echec explicite si la conversion echoue.
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.db import async_session_factory
from ferry_agent.models import (
    DeliveryJob,
    DeliveryMethod,
    DeliveryStatus,
    DeliveryTier,
    Device,
    LibraryItem,
    User,
)
from ferry_agent.services import cloud_links, conversion_profiles, converters, mailer, tierc

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def resolve_target_format(
    requested_format: str | None,
    *,
    default_format: str | None,
    original_format: str,
) -> str:
    """Format exact a produire pour cette livraison."""
    chosen = (requested_format or default_format or original_format).lower().lstrip(".")
    return chosen


async def _fail(db: AsyncSession, job: DeliveryJob, error: str) -> None:
    job.status = DeliveryStatus.failed
    job.error = error
    await db.commit()


async def _materialize_or_fail(
    db: AsyncSession,
    job: DeliveryJob,
    item: LibraryItem,
    device: Device,
    target_format: str,
) -> tuple[str, bool] | None:
    """Convertit vers `target_format` ou marque le job en echec. Retourne None si echec."""
    job.target_format = target_format
    preset = conversion_profiles.resolve_preset_id(device.conversion_profile)
    try:
        return await converters.materialize_target_format(
            library_item_id=item.id,
            src_path=item.storage_path,
            original_format=item.original_format,
            target_format=target_format,
            preset=preset,
        )
    except Exception:
        logger.exception("conversion vers %s echouee pour le job %s", target_format, job.id)
        await _fail(db, job, converters.CONVERSION_FAILED_USER_MESSAGE)
        return None


def _cleanup_derivative(file_path: str, item: LibraryItem, cached_derivative: bool) -> None:
    if file_path != item.storage_path and not cached_derivative and not conversion_profiles.is_cached_derivative(
        file_path
    ):
        Path(file_path).unlink(missing_ok=True)


async def _deliver_tier_a(
    db: AsyncSession,
    job: DeliveryJob,
    item: LibraryItem,
    device: Device,
    user: User,
    requested_format: str | None = None,
) -> None:
    """Send-to-Kindle / envoi email direct (SMTP)."""
    if not user.kindle_email:
        await _fail(db, job, "adresse kindle_email manquante sur l'utilisateur")
        return
    if not mailer.is_configured():
        await _fail(db, job, "SMTP non configure (envoi email desactive)")
        return

    target_format = resolve_target_format(
        requested_format,
        default_format=user.default_format,
        original_format=item.original_format,
    )
    materialized = await _materialize_or_fail(db, job, item, device, target_format)
    if materialized is None:
        return
    file_path, cached_derivative = materialized

    try:
        filename = Path(file_path).name
        if Path(filename).suffix.lstrip(".").lower() != target_format:
            await _fail(db, job, converters.CONVERSION_FAILED_USER_MESSAGE)
            return

        job.status = DeliveryStatus.sent
        await db.commit()

        try:
            await mailer.send_file(file_path, filename, user.kindle_email, kindle=True)
        except Exception as exc:
            await _fail(db, job, str(exc))
            return

        job.status = DeliveryStatus.delivered
        job.delivered_at = _utcnow()
        await db.commit()
    finally:
        _cleanup_derivative(file_path, item, cached_derivative)


async def _deliver_tier_b(
    db: AsyncSession,
    job: DeliveryJob,
    item: LibraryItem,
    device: Device,
    user: User,
    requested_format: str | None = None,
) -> None:
    """Upload Dropbox/Google Drive : l'utilisateur recupere le fichier depuis
    l'app cloud sur sa liseuse (Kobo haut de gamme), puis tape "Sync"."""
    if not device.link_ref:
        await _fail(db, job, "provider cloud non lie (voir GET /api/v1/devices/{id}/link)")
        return

    try:
        link_ref = cloud_links.parse_link_ref(device.link_ref)
    except cloud_links.CloudLinkError as exc:
        await _fail(db, job, str(exc))
        return

    target_format = resolve_target_format(
        requested_format,
        default_format=user.default_format,
        original_format=item.original_format,
    )
    materialized = await _materialize_or_fail(db, job, item, device, target_format)
    if materialized is None:
        return
    file_path, cached_derivative = materialized

    try:
        filename = Path(file_path).name
        if Path(filename).suffix.lstrip(".").lower() != target_format:
            await _fail(db, job, converters.CONVERSION_FAILED_USER_MESSAGE)
            return
        file_bytes = Path(file_path).read_bytes()

        job.status = DeliveryStatus.sent
        job.method = DeliveryMethod.dropbox if link_ref["provider"] == "dropbox" else DeliveryMethod.drive
        await db.commit()

        try:
            await cloud_links.upload_job_file(device.link_ref, filename, file_bytes)
        except Exception as exc:
            await _fail(db, job, str(exc))
            return

        job.status = DeliveryStatus.delivered
        job.delivered_at = _utcnow()
        await db.commit()
    finally:
        _cleanup_derivative(file_path, item, cached_derivative)


async def _deliver_tier_c(
    db: AsyncSession,
    job: DeliveryJob,
    item: LibraryItem,
    device: Device,
    user: User,
    requested_format: str | None = None,
) -> str | None:
    """Mini-catalogue HTTP + code court : cree la session de telechargement.

    La conversion vers le format demande est realisee maintenant (cache) pour
    que le telechargement ulterieur serve exactement ce format.
    """
    target_format = resolve_target_format(
        requested_format,
        default_format=user.default_format,
        original_format=item.original_format,
    )
    materialized = await _materialize_or_fail(db, job, item, device, target_format)
    if materialized is None:
        return None
    file_path, _cached = materialized
    if Path(file_path).suffix.lstrip(".").lower() != target_format:
        await _fail(db, job, converters.CONVERSION_FAILED_USER_MESSAGE)
        return None

    _short_code, url = await tierc.create_download_session(db, job.id)
    job.status = DeliveryStatus.sent
    job.method = DeliveryMethod.browser_code
    job.target_format = target_format
    await db.commit()
    logger.info("livraison tier C prete pour le job %s: %s", job.id, url)
    return url


async def deliver(
    db: AsyncSession,
    job: DeliveryJob,
    requested_format: str | None = None,
) -> str | None:
    """Route un DeliveryJob vers son tier. Retourne l'URL de telechargement
    pour le tier C (synchrone), sinon None."""
    item_result = await db.execute(select(LibraryItem).where(LibraryItem.id == job.library_item_id))
    item = item_result.scalar_one_or_none()
    device_result = await db.execute(select(Device).where(Device.id == job.device_id))
    device = device_result.scalar_one_or_none()

    if item is None or device is None:
        await _fail(db, job, "library_item ou device introuvable")
        return None

    try:
        if device.delivery_tier == DeliveryTier.A:
            user_result = await db.execute(select(User).where(User.id == item.user_id))
            user = user_result.scalar_one_or_none()
            if user is None:
                await _fail(db, job, "utilisateur introuvable")
                return None
            await _deliver_tier_a(db, job, item, device, user, requested_format)
            return None
        if device.delivery_tier == DeliveryTier.B:
            user_result = await db.execute(select(User).where(User.id == item.user_id))
            user = user_result.scalar_one_or_none()
            if user is None:
                await _fail(db, job, "utilisateur introuvable")
                return None
            await _deliver_tier_b(db, job, item, device, user, requested_format)
            return None
        if device.delivery_tier == DeliveryTier.C:
            user_result = await db.execute(select(User).where(User.id == item.user_id))
            user = user_result.scalar_one_or_none()
            if user is None:
                await _fail(db, job, "utilisateur introuvable")
                return None
            return await _deliver_tier_c(db, job, item, device, user, requested_format)
        await _fail(db, job, f"tier {device.delivery_tier.value} non implemente")
        return None
    except Exception as exc:  # pragma: no cover - filet de securite
        logger.exception("livraison echouee pour le job %s", job.id)
        await _fail(db, job, str(exc))
        return None


async def run_delivery(job_id: uuid.UUID, requested_format: str | None = None) -> None:
    """Point d'entree pour BackgroundTasks : ouvre sa propre session DB."""
    async with async_session_factory() as db:
        result = await db.execute(select(DeliveryJob).where(DeliveryJob.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            logger.warning("delivery job %s introuvable pour livraison en tache de fond", job_id)
            return
        await deliver(db, job, requested_format)
