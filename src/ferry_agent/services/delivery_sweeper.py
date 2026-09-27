"""Balayeur des jobs de livraison bloques en ``queued``.

``fastapi.BackgroundTasks`` execute l'envoi dans le processus : un redemarrage
du conteneur laisse le job en ``queued`` pour toujours. Ce module marque ces
orphelins en ``failed`` avec un motif actionnable.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.models import DeliveryJob, DeliveryStatus

logger = logging.getLogger(__name__)

_STUCK_ERROR = "Livraison interrompue avant envoi (service redémarré). Relancez la livraison."


async def reap_stuck_jobs(db: AsyncSession, stuck_after_minutes: int) -> int:
    """Passe en ``failed`` les jobs ``queued`` plus vieux que le seuil.

    Ne touche jamais un job ``sent``, ``delivered`` ou ``failed``.
    Retourne le nombre de jobs repris.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stuck_after_minutes)
    result = await db.execute(
        select(DeliveryJob).where(
            DeliveryJob.status == DeliveryStatus.queued,
            DeliveryJob.created_at < cutoff,
        )
    )
    jobs = list(result.scalars().all())
    for job in jobs:
        job.status = DeliveryStatus.failed
        job.error = _STUCK_ERROR
    if jobs:
        await db.commit()
    count = len(jobs)
    if count:
        logger.info("delivery sweeper: %d job(s) bloque(s) repris", count)
    return count
