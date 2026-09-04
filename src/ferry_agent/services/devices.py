"""Gestion des Device (liseuses) : suppression et purge des donnees liees."""

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.models import DeliveryJob, Device


async def delete_device(db: AsyncSession, device: Device) -> None:
    """Purge les `DeliveryJob` du device puis le device lui-meme (les FK
    n'ont pas d'ondelete, donc les enfants doivent partir avant le parent).

    L'historique de livraisons lie a un appareil supprime n'a plus de sens
    (contrairement a celui d'un livre, cf. services/library.py).
    """
    await db.execute(delete(DeliveryJob).where(DeliveryJob.device_id == device.id))
    await db.delete(device)
    await db.commit()
