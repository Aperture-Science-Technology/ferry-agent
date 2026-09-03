"""Mise en file de livraisons vers une liseuse.

L'envoi effectif (email, dropbox, browser code, USB) est hors perimetre de
M0 : ce module se contente de creer et lister des `DeliveryJob` a l'etat
`queued`. Toutes les entites referencees (LibraryItem, Device) doivent
appartenir a l'utilisateur courant, sinon 404 (pas de fuite inter-user).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import DeliveryJob, Device, LibraryItem
from ferry_agent.schemas import DeliveryCreate, DeliveryOut

router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])


@router.post("", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    payload: DeliveryCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeliveryOut:
    item_result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == payload.library_item_id, LibraryItem.user_id == user.id
        )
    )
    if item_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="library_item introuvable")

    device_result = await db.execute(
        select(Device).where(Device.id == payload.device_id, Device.user_id == user.id)
    )
    if device_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device introuvable")

    job = DeliveryJob(
        library_item_id=payload.library_item_id,
        device_id=payload.device_id,
        method=payload.method,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return DeliveryOut.model_validate(job)


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
