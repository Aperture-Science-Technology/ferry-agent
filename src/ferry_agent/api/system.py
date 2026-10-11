"""User-scoped operational facts, without infrastructure addresses or credentials."""

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import DeliveryJob, DeliveryStatus, Device, Gateway, LibraryItem, PairingStatus
from ferry_agent.services import converters, mail_policy, mailer

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/health")
async def system_health(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    count, used = (
        await db.execute(
            select(func.count(LibraryItem.id), func.coalesce(func.sum(LibraryItem.size_bytes), 0)).where(
                LibraryItem.user_id == user.id
            )
        )
    ).one()
    gateway_counts = (
        await db.execute(
            select(
                func.count(Gateway.id),
                func.count(Gateway.id).filter(
                    Gateway.pairing_status == PairingStatus.paired,
                    Gateway.last_seen_at >= now - timedelta(seconds=settings.gateway_online_seconds),
                ),
                func.count(Gateway.id).filter(Gateway.pairing_status == PairingStatus.pending),
                func.count(Gateway.id).filter(Gateway.pairing_status == PairingStatus.revoked),
            ).where(Gateway.user_id == user.id)
        )
    ).one()
    deliveries = dict(
        (
            await db.execute(
                select(DeliveryJob.status, func.count())
                .join(Device)
                .where(Device.user_id == user.id, DeliveryJob.created_at >= now - timedelta(days=7))
                .group_by(DeliveryJob.status)
            )
        ).all()
    )
    used = int(used)
    quota = settings.user_storage_quota_bytes
    return {
        "converters": await asyncio.to_thread(converters.conversion_capacity),
        "mail": {
            "configured": mailer.is_configured(),
            "sender_address": settings.smtp_from or settings.smtp_user or "",
            "domains_allowed": sorted(mail_policy.allowed_domains()),
        },
        "storage": {
            "used_bytes": used,
            "quota_bytes": quota,
            "percentage": round(100 * used / quota, 2) if quota else None,
        },
        "gateways": dict(zip(("total", "online", "pending", "revoked"), gateway_counts, strict=True)),
        "library": {
            "items": count,
            "deliveries_last_7_days": {state.value: deliveries.get(state, 0) for state in DeliveryStatus},
        },
        "version": request.app.version or None,
    }
