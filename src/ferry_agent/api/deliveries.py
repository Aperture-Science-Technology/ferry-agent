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

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import DeliveryJob, DeliveryTier, Device, LibraryItem
from ferry_agent.schemas import DeliveryCreate, DeliveryOut
from ferry_agent.services import delivery as delivery_service
from ferry_agent.services import mailer
from ferry_agent.services.delivery_methods import is_method_allowed

router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])


@router.post("", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    payload: DeliveryCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    item_result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == payload.library_item_id, LibraryItem.user_id == user.id
        )
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="library_item introuvable")

    device_result = await db.execute(
        select(Device).where(Device.id == payload.device_id, Device.user_id == user.id)
    )
    device = device_result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device introuvable")

    if not is_method_allowed(device, payload.method, mailer.is_configured()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"method '{payload.method.value}' indisponible pour ce device (tier {device.delivery_tier.value})",
        )

    job = DeliveryJob(
        library_item_id=item.id,
        device_id=payload.device_id,
        method=payload.method,
        item_title=item.title,
        item_author=item.author,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    download_url = None
    if device.delivery_tier in (DeliveryTier.A, DeliveryTier.B):
        background_tasks.add_task(delivery_service.run_delivery, job.id, payload.format)
    elif device.delivery_tier == DeliveryTier.C:
        download_url = await delivery_service.deliver(db, job, payload.format)

    out = DeliveryOut.model_validate(job)
    out.download_url = download_url
    return out


@router.get("", response_model=list[DeliveryOut])
async def list_deliveries(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeliveryOut]:
    result = await db.execute(
        select(DeliveryJob)
        .join(LibraryItem, DeliveryJob.library_item_id == LibraryItem.id)
        .where(LibraryItem.user_id == user.id)
    )
    jobs = result.scalars().all()
    return [DeliveryOut.model_validate(j) for j in jobs]


@router.get("/{job_id}", response_model=DeliveryOut)
async def get_delivery(
    job_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    result = await db.execute(
        select(DeliveryJob)
        .join(LibraryItem, DeliveryJob.library_item_id == LibraryItem.id)
        .where(DeliveryJob.id == job_id, LibraryItem.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="delivery job introuvable")
    return DeliveryOut.model_validate(job)
