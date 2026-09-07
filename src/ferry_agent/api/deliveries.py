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
from ferry_agent.models import DeliveryJob, DeliveryTier, Device, DeviceBrand, LibraryItem
from ferry_agent.schemas import DeliveryCreate, DeliveryOut
from ferry_agent.services import delivery as delivery_service
from ferry_agent.services import mailer
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
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeliveryOut]:
    # outerjoin LibraryItem : apres W-02 le livre peut avoir ete supprime
    # (library_item_id NULL) ; le scope user passe par Device (toujours present).
    result = await db.execute(
        select(*_DELIVERY_LIST_COLS)
        .join(Device, DeliveryJob.device_id == Device.id)
        .outerjoin(LibraryItem, DeliveryJob.library_item_id == LibraryItem.id)
        .where(Device.user_id == user.id)
    )
    return [
        build_delivery_out(
            job,
            item_title=title,
            item_author=author,
            device_name=name,
            device_brand=brand,
            device_model=model,
        )
        for job, title, author, name, brand, model in result.all()
    ]


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
    return build_delivery_out(
        job,
        item_title=title,
        item_author=author,
        device_name=name,
        device_brand=brand,
        device_model=model,
    )
