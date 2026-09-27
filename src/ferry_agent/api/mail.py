"""Reglages d'envoi email visibles par l'utilisateur (Send-to-Kindle).

N'expose ni hote SMTP, ni port, ni identifiants — uniquement ce dont
l'utilisateur a besoin pour configurer Amazon et comprendre les quotas.
"""

from fastapi import APIRouter, Depends

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import get_settings
from ferry_agent.schemas import MailSettingsOut
from ferry_agent.services import mail_policy, mailer

router = APIRouter(prefix="/api/v1/mail", tags=["mail"])


@router.get("/settings", response_model=MailSettingsOut)
async def get_mail_settings(
    _user: CurrentUser = Depends(get_current_user),
) -> MailSettingsOut:
    settings = get_settings()
    return MailSettingsOut(
        configured=mailer.is_configured(),
        sender_address=settings.smtp_from or "",
        reply_to=settings.smtp_reply_to,
        allowed_domains=sorted(mail_policy.allowed_domains()),
        hourly_quota=settings.email_send_hourly_quota,
        daily_quota=settings.email_send_daily_quota,
    )
