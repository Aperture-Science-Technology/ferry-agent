"""Reglages d'envoi email visibles par l'utilisateur (Send-to-Kindle).

N'expose ni hote SMTP, ni port, ni identifiants — uniquement ce dont
l'utilisateur a besoin pour configurer Amazon et comprendre les quotas.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import Device, User
from ferry_agent.schemas import MailSettingsOut, MailTestOut, MailTestRequest
from ferry_agent.services import mail_policy, mailer

router = APIRouter(prefix="/api/v1/mail", tags=["mail"])


@router.get("/settings", response_model=MailSettingsOut)
async def get_mail_settings(
    _user: CurrentUser = Depends(get_current_user),
) -> MailSettingsOut:
    settings = get_settings()
    return MailSettingsOut(
        configured=mailer.is_configured(),
        sender_address=settings.smtp_from or settings.smtp_user or "",
        sender_domain=(settings.smtp_from or settings.smtp_user or "").rpartition("@")[2],
        domains_allowed=sorted(mail_policy.allowed_domains()),
        reply_to=settings.smtp_reply_to,
        allowed_domains=sorted(mail_policy.allowed_domains()),
        hourly_quota=settings.email_send_hourly_quota,
        daily_quota=settings.email_send_daily_quota,
    )


@router.post("/test", response_model=MailTestOut)
async def test_mail(
    payload: MailTestRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MailTestOut:
    device = None
    if payload.device_id is not None:
        device = (
            await db.execute(select(Device).where(Device.id == payload.device_id, Device.user_id == user.id))
        ).scalar_one_or_none()
        if device is None:
            raise HTTPException(404, "Liseuse introuvable")
    profile = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
    recipient = (device.email_address if device else None) or profile.kindle_email
    if not recipient:
        raise HTTPException(400, "Ajoutez votre adresse Send-to-Kindle dans les réglages de la liseuse ou du compte.")
    if not mail_policy.is_allowed_recipient(recipient):
        raise HTTPException(400, str(mail_policy.RecipientNotAllowed()))
    if not mailer.is_configured():
        raise HTTPException(503, "L’envoi par email est indisponible. Réessayez plus tard.")
    await db.execute(text("SELECT pg_advisory_xact_lock(731902)"))
    try:
        await mail_policy.enforce_send_quota(db, user.id)
    except RuntimeError as exc:
        raise HTTPException(429, str(exc)) from exc
    await db.refresh(profile)
    now = datetime.now(timezone.utc)
    profile.mail_test_sends = [
        stamp for stamp in profile.mail_test_sends if datetime.fromisoformat(stamp) >= now - timedelta(days=1)
    ] + [now.isoformat()]
    await db.commit()
    try:
        await mailer.send_test(recipient)
    except Exception as exc:
        raise HTTPException(502, "L’envoi du test a échoué. Réessayez plus tard et vérifiez l’adresse Kindle.") from exc
    return MailTestOut(recipient=recipient)
