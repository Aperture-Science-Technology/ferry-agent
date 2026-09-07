"""Gestion des Device (liseuses) : suppression.

Les `DeliveryJob` (et leurs `ShortCode` tier C) partent via
`ON DELETE CASCADE` sur `delivery_jobs.device_id` /
`short_codes.delivery_job_id` — plus besoin de purge manuelle.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.models import Device


async def delete_device(db: AsyncSession, device: Device) -> None:
    """Supprime le device ; l'historique de livraisons lie part en CASCADE
    (contrairement a celui d'un livre, cf. services/library.py)."""
    await db.delete(device)
    await db.commit()
