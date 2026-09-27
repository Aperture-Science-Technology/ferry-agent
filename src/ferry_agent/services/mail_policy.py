"""Politique d'envoi email : domaines Send-to-Kindle et quotas anti-abus.

Le relais SMTP appartient a la plateforme. Sans liste blanche de destinataires
et sans plafonds, un utilisateur pourrait l'utiliser comme canon a spam et
saturer le quota journalier Resend (partage par tout le compte).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.config import get_settings
from ferry_agent.models import DeliveryJob, DeliveryMethod, Device

_QUOTA_EXCEEDED_MESSAGE = "quota d'envois atteint, réessayez plus tard"


class RecipientNotAllowed(ValueError):
    """Destinataire hors domaines Send-to-Kindle (message actionnable)."""

    def __init__(self) -> None:
        super().__init__(
            "Seules les adresses Send-to-Kindle sont acceptées "
            "(@kindle.com, @kindle.fr, etc.). "
            "Amazon attribue cette adresse dans « Manage Your Content and Devices »."
        )


def allowed_domains() -> frozenset[str]:
    """Domaines autorises derives de ``settings.kindle_email_domains``."""
    raw = get_settings().kindle_email_domains
    return frozenset(part.strip().lower() for part in raw.split(",") if part.strip())


def is_allowed_recipient(email: str) -> bool:
    """True si la partie apres ``@`` (minuscules) est un domaine Kindle autorise."""
    if not email or "@" not in email:
        return False
    local, _, domain = email.rpartition("@")
    if not local.strip() or not domain.strip():
        return False
    return domain.strip().lower() in allowed_domains()


async def count_recent_email_sends(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    since: datetime,
) -> int:
    """Compte les ``DeliveryJob`` email crees depuis ``since``.

    Si ``user_id`` est fourni, filtre via jointure ``Device.user_id`` ;
    sinon compte tous les utilisateurs (quota journalier global).
    """
    stmt = (
        select(func.count())
        .select_from(DeliveryJob)
        .where(
            DeliveryJob.method == DeliveryMethod.email,
            DeliveryJob.created_at >= since,
        )
    )
    if user_id is not None:
        stmt = stmt.join(Device, DeliveryJob.device_id == Device.id).where(Device.user_id == user_id)
    result = await db.execute(stmt)
    return int(result.scalar_one_or_none() or 0)


async def enforce_send_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Leve ``RuntimeError`` si le quota horaire (user) ou journalier (global) est atteint."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    hourly = await count_recent_email_sends(db, user_id=user_id, since=now - timedelta(hours=1))
    if hourly >= settings.email_send_hourly_quota:
        raise RuntimeError(_QUOTA_EXCEEDED_MESSAGE)
    daily = await count_recent_email_sends(db, user_id=None, since=now - timedelta(days=1))
    if daily >= settings.email_send_daily_quota:
        raise RuntimeError(_QUOTA_EXCEEDED_MESSAGE)
