"""Execution reelle des livraisons vers une liseuse, routee par tier.

`deliver(db, job, ...)` resout `LibraryItem`/`Device`/`User` puis delegue a
l'implementation du tier du device. `run_delivery(job_id, ...)` est le point
d'entree pour `fastapi.BackgroundTasks` : il ouvre sa propre session car la
session de la requete HTTP est deja fermee quand une tache de fond s'execute.
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
    DeviceBrand,
    LibraryItem,
    User,
)
from ferry_agent.services import cloud_links, conversion_profiles, converters, mailer, tierc

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _fail(db: AsyncSession, job: DeliveryJob, error: str) -> None:
    job.status = DeliveryStatus.failed
    job.error = error
    await db.commit()


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

    file_path = item.storage_path
    target_format = (requested_format or user.default_format or item.original_format).lower()
    preset = conversion_profiles.resolve_preset_id(device.conversion_profile)
    cached_derivative = False

    if (
        device.brand == DeviceBrand.kindle
        and target_format in ("mobi", "azw3")
        and item.original_format.lower() == "epub"
    ):
        convert_kind = "epub_to_mobi" if target_format == "mobi" else "epub_to_azw3"
        try:
            file_path, cached_derivative = await converters.convert_with_profile_cache(
                library_item_id=item.id,
                src_path=item.storage_path,
                target_format=target_format,
                preset=preset,
                convert_kind=convert_kind,
            )
        except Exception:
            logger.exception("conversion Kindle echouee pour le job %s", job.id)
            await _fail(db, job, converters.CONVERSION_FAILED_USER_MESSAGE)
            return

    try:
        filename = Path(file_path).name

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
        if file_path != item.storage_path and not cached_derivative and not conversion_profiles.is_cached_derivative(
            file_path
        ):
            Path(file_path).unlink(missing_ok=True)


async def _deliver_tier_b(
    db: AsyncSession,
    job: DeliveryJob,
    item: LibraryItem,
    device: Device,
    user: User,
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

    file_path = item.storage_path
    preset = conversion_profiles.resolve_preset_id(device.conversion_profile)
    cached_derivative = False
    if item.original_format.lower() != "epub":
        try:
            file_path, cached_derivative = await converters.convert_with_profile_cache(
                library_item_id=item.id,
                src_path=item.storage_path,
                target_format="epub",
                preset=preset,
                convert_kind="to_epub",
            )
        except Exception:
            logger.exception("conversion EPUB echouee pour le job %s", job.id)
            await _fail(db, job, converters.CONVERSION_FAILED_USER_MESSAGE)
            return

    try:
        filename = Path(file_path).name
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
        if file_path != item.storage_path and not cached_derivative and not conversion_profiles.is_cached_derivative(
            file_path
        ):
            Path(file_path).unlink(missing_ok=True)


async def _deliver_tier_c(db: AsyncSession, job: DeliveryJob, item: LibraryItem) -> str:
    """Mini-catalogue HTTP + code court : cree la session de telechargement."""
    _short_code, url = await tierc.create_download_session(db, job.id)
    job.status = DeliveryStatus.sent
    job.method = DeliveryMethod.browser_code
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
            await _deliver_tier_b(db, job, item, device, user)
            return None
        if device.delivery_tier == DeliveryTier.C:
            return await _deliver_tier_c(db, job, item)
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
