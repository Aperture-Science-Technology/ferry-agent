"""Mise en file et execution des livraisons vers une liseuse.

La creation d'un job de livraison declenche reellement l'envoi :
- tier A (Send-to-Kindle / email) est traite en tache de fond
  (`fastapi.BackgroundTasks`) car l'envoi SMTP peut prendre du temps ; la
  reponse HTTP renvoie le job a l'etat `queued` et le suivi se fait via
  GET /api/v1/deliveries/{job_id}.
- tier C (mini-catalogue HTTP + code court) est resolu de maniere
  synchrone car le lien de telechargement doit etre renvoye immediatement
  dans la reponse (rien n'est envoye sur le reseau, l'utilisateur telecharge
  lui-meme via le navigateur embarque de sa liseuse).

Toutes les entites referencees (LibraryItem, Device) doivent appartenir a
l'utilisateur courant, sinon 404 (pas de fuite inter-user).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
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
from ferry_agent.schemas import DeliveryCreate, DeliveryOut, DeliveryPreview
from ferry_agent.services import delivery as delivery_service
from ferry_agent.services import mail_policy, mailer, opds
from ferry_agent.services.delivery_methods import is_method_allowed

router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])

# Colonnes jointes pour enrichir DeliveryOut (titre / auteur / label appareil).
_DELIVERY_LIST_COLS = (
    DeliveryJob,
    LibraryItem.title,
    LibraryItem.author,
    Device.name,
    Device.brand,
    Device.model,
)


def _device_label(
    name: str | None,
    brand: DeviceBrand | None,
    model: str | None,
) -> str | None:
    if name:
        return name
    if brand is None:
        return None
    return f"{brand.value} {model or ''}".strip()


def build_delivery_out(
    job: DeliveryJob,
    *,
    item_title: str | None = None,
    item_author: str | None = None,
    device_name: str | None = None,
    device_brand: DeviceBrand | None = None,
    device_model: str | None = None,
) -> DeliveryOut:
    """Construit un DeliveryOut enrichi ; repli sur les colonnes denormalisees."""
    return DeliveryOut.model_validate(job).model_copy(
        update={
            "item_title": item_title if item_title is not None else job.item_title,
            "item_author": item_author if item_author is not None else job.item_author,
            "device_label": _device_label(device_name, device_brand, device_model),
        }
    )


@router.post("", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    payload: DeliveryCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    item_result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == payload.library_item_id, LibraryItem.user_id == user.id)
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="library_item introuvable")

    device_result = await db.execute(select(Device).where(Device.id == payload.device_id, Device.user_id == user.id))
    device = device_result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device introuvable")

    user_result = await db.execute(select(User).where(User.id == user.id))
    db_user = user_result.scalar_one_or_none()
    kindle_email = db_user.kindle_email if db_user else None

    if not is_method_allowed(device, payload.method, mailer.is_configured(), kindle_email=kindle_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"method '{payload.method.value}' indisponible pour ce device (tier {device.delivery_tier.value})",
        )

    if payload.method == DeliveryMethod.email:
        try:
            await mail_policy.enforce_send_quota(db, user.id)
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    job = DeliveryJob(
        library_item_id=item.id,
        device_id=payload.device_id,
        method=payload.method,
        item_title=item.title,
        item_author=item.author,
        target_format=payload.format,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    download_url = None
    if device.delivery_tier in (DeliveryTier.A, DeliveryTier.B):
        background_tasks.add_task(delivery_service.run_delivery, job.id, payload.format)
    elif device.delivery_tier in (DeliveryTier.C, DeliveryTier.D):
        download_url = await delivery_service.deliver_synchronously(db, job, payload.format)

    out = build_delivery_out(
        job,
        item_title=item.title,
        item_author=item.author,
        device_name=device.name,
        device_brand=device.brand,
        device_model=device.model,
    )
    out.download_url = download_url
    return out


@router.get("", response_model=list[DeliveryOut])
async def list_deliveries(
    q: str | None = None,
    status: DeliveryStatus | None = None,
    device_id: uuid.UUID | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeliveryOut]:
    stmt = (
        select(*_DELIVERY_LIST_COLS)
        .join(Device, DeliveryJob.device_id == Device.id)
        .outerjoin(LibraryItem, DeliveryJob.library_item_id == LibraryItem.id)
        .where(Device.user_id == user.id)
    )
    if q:
        pattern = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(
            or_(
                func.unaccent(func.coalesce(LibraryItem.title, DeliveryJob.item_title)).ilike(
                    func.unaccent(pattern), escape="\\"
                ),
                func.unaccent(Device.name).ilike(func.unaccent(pattern), escape="\\"),
            )
        )
    if status is not None:
        stmt = stmt.where(DeliveryJob.status == status)
    if device_id is not None:
        stmt = stmt.where(DeliveryJob.device_id == device_id)
    result = await db.execute(
        stmt.order_by(DeliveryJob.created_at.desc(), DeliveryJob.id.desc()).offset((page - 1) * limit).limit(limit)
    )
    joined = result.all()
    rows = [
        build_delivery_out(
            job,
            item_title=title,
            item_author=author,
            device_name=name,
            device_brand=brand,
            device_model=model,
        )
        for job, title, author, name, brand, model in joined
    ]
    hashes = [row[0].catalog_token_hash for row in joined if row[0].catalog_token_hash]
    urls = await opds.delivery_catalog_urls(db, user.id, hashes)
    for out, row in zip(rows, joined, strict=True):
        if out.method == DeliveryMethod.opds:
            out.download_url = urls.get(row[0].catalog_token_hash)
    return rows


@router.get("/preview", response_model=DeliveryPreview)
async def preview_delivery(
    library_item_id: uuid.UUID,
    device_id: uuid.UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str | None = None,
) -> DeliveryPreview:
    """Résout le format avec la règle de livraison, sans envoi ni conversion."""
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == library_item_id, LibraryItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Livre introuvable")
    result = await db.execute(select(Device).where(Device.id == device_id, Device.user_id == user.id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Liseuse introuvable")
    result = await db.execute(select(User).where(User.id == user.id))
    profile = result.scalar_one_or_none()
    return DeliveryPreview(
        target_format=delivery_service.resolve_target_format(
            format,
            default_format=profile.default_format if profile else None,
            original_format=item.original_format,
            delivery_tier=device.delivery_tier,
        )
    )


@router.get("/{job_id}", response_model=DeliveryOut)
async def get_delivery(
    job_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    result = await db.execute(
        select(*_DELIVERY_LIST_COLS)
        .join(Device, DeliveryJob.device_id == Device.id)
        .outerjoin(LibraryItem, DeliveryJob.library_item_id == LibraryItem.id)
        .where(DeliveryJob.id == job_id, Device.user_id == user.id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="delivery job introuvable")
    job, title, author, name, brand, model = row
    out = build_delivery_out(
        job,
        item_title=title,
        item_author=author,
        device_name=name,
        device_brand=brand,
        device_model=model,
    )

    if job.method == DeliveryMethod.opds:
        out.download_url = await opds.delivery_catalog_url(db, user.id, job.catalog_token_hash)
    return out


async def _owned_job(db: AsyncSession, job_id: uuid.UUID, user_id: uuid.UUID) -> tuple[DeliveryJob, Device]:
    result = await db.execute(
        select(DeliveryJob, Device).join(Device).where(DeliveryJob.id == job_id, Device.user_id == user_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(404, "Livraison introuvable")
    locked = await db.execute(
        text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": delivery_service.job_lock_key(job_id)}
    )
    if not locked.scalar_one():
        raise HTTPException(409, "Cette livraison est déjà en cours. Actualisez son état.")
    await db.execute(
        select(DeliveryJob).where(DeliveryJob.id == job_id).with_for_update().execution_options(populate_existing=True)
    )
    return row


@router.post("/{job_id}/cancel", response_model=DeliveryOut)
async def cancel_delivery(
    job_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    job, device = await _owned_job(db, job_id, user.id)
    if job.status != DeliveryStatus.queued:
        raise HTTPException(409, "Seule une livraison en attente peut être annulée.")
    job.status = DeliveryStatus.failed
    job.error = "annulé par l'utilisateur"
    await db.commit()
    return await get_delivery(job_id, user, db)


@router.post("/{job_id}/retry", response_model=DeliveryOut)
async def retry_delivery(
    job_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    job, device = await _owned_job(db, job_id, user.id)
    if job.status != DeliveryStatus.failed:
        raise HTTPException(409, "Seule une livraison en échec peut être relancée.")
    item = (
        await db.execute(
            select(LibraryItem).where(LibraryItem.id == job.library_item_id, LibraryItem.user_id == user.id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(409, "Ce livre a été supprimé. Ajoutez-le à nouveau avant de l’envoyer.")
    profile = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
    if not is_method_allowed(device, job.method, mailer.is_configured(), kindle_email=profile.kindle_email):
        raise HTTPException(400, "Ce mode d’envoi est indisponible. Vérifiez les réglages de la liseuse.")
    if job.method == DeliveryMethod.email:
        try:
            await mail_policy.enforce_send_quota(db, user.id)
        except RuntimeError as exc:
            raise HTTPException(429, str(exc)) from exc
    job.status = DeliveryStatus.queued
    job.attempts = 0
    job.error = None
    job.relay_response = None
    job.delivered_at = None
    await db.commit()
    url = None
    if device.delivery_tier in (DeliveryTier.A, DeliveryTier.B):
        background_tasks.add_task(delivery_service.run_delivery, job.id, job.target_format)
    else:
        url = await delivery_service.deliver_synchronously(db, job, job.target_format)
    out = await get_delivery(job_id, user, db)
    out.download_url = url
    return out
