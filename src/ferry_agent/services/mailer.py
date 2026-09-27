"""Envoi d'ebooks par email (Send-to-Kindle et autres adresses).

L'envoi SMTP est synchrone (`smtplib`) et delegue a un thread via
`run_in_executor` pour ne pas bloquer la boucle asyncio. Si SMTP n'est pas
configure (`smtp_user`/`smtp_password` absents), `is_configured()` retourne
False et l'appelant doit s'en servir pour eviter d'appeler `send_file`
plutot que de planter au premier envoi.

TLS : toujours un contexte verifiant (`ssl.create_default_context()`), jamais
le defaut smtplib (`_create_stdlib_context` = CERT_NONE).
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

from ferry_agent.config import get_settings
from ferry_agent.services.file_validation import content_type_for_filename

logger = logging.getLogger(__name__)

#: Majorant empirique taille MIME (base64 ≈ ×4/3 + en-tetes).
_MIME_OVERHEAD_FACTOR = 1.37


class MailerNotConfigured(RuntimeError):
    """SMTP_* absent : l'appelant doit refuser la livraison, pas tenter un envoi."""


class MessageTooLargeForRelay(RuntimeError):
    """Le message encode depasse le plafond du relais : echec actionnable."""


def is_configured() -> bool:
    settings = get_settings()
    if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
        return False
    if settings.smtp_security == "starttls" and settings.smtp_port == 465:
        # Incoherence classique : 465 = TLS implicite, STARTTLS echouera.
        return False
    return True


def encoded_size_bound(raw_bytes: int) -> int:
    """Majorant de la taille du message une fois encode en base64."""
    return int(raw_bytes * _MIME_OVERHEAD_FACTOR)


def build_message(file_path: str, filename: str, recipient_email: str, *, kindle: bool) -> EmailMessage:
    settings = get_settings()
    sender = settings.smtp_from or settings.smtp_user
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient_email
    message["Subject"] = "Votre document" if kindle else f"Ferry Agent : {filename}"
    message["Date"] = formatdate(localtime=False)
    domain = (sender or "").rpartition("@")[2] or "ferry-agent.invalid"
    message["Message-ID"] = make_msgid(domain=domain)
    if settings.smtp_reply_to:
        message["Reply-To"] = settings.smtp_reply_to
    message.set_content("Document envoye par Ferry Agent.")

    content_type = content_type_for_filename(filename)
    maintype, _, subtype = content_type.partition("/")
    message.add_attachment(
        Path(file_path).read_bytes(),
        maintype=maintype,
        subtype=subtype or "octet-stream",
        filename=filename,
    )
    return message


def _connect() -> smtplib.SMTP:
    settings = get_settings()
    context = ssl.create_default_context()
    if settings.smtp_security == "ssl":
        return smtplib.SMTP_SSL(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
            context=context,
        )
    smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds)
    smtp.ehlo()
    smtp.starttls(context=context)
    smtp.ehlo()
    return smtp


def _send_sync(file_path: str, filename: str, recipient_email: str, kindle: bool) -> None:
    settings = get_settings()
    message = build_message(file_path, filename, recipient_email, kindle=kindle)
    raw_size = len(message.as_bytes())
    limit = min(settings.smtp_max_message_bytes, settings.amazon_send_to_kindle_max_bytes)
    if raw_size > limit:
        raise MessageTooLargeForRelay(
            f"Message encode de {raw_size // 1024} Ko > plafond {limit // 1024} Ko : "
            "utilisez le telechargement navigateur (tier C) pour ce livre."
        )
    with _connect() as smtp:
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


async def send_file(file_path: str, filename: str, recipient_email: str, kindle: bool = False) -> None:
    if not is_configured():
        raise MailerNotConfigured("SMTP non configure (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)")

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _send_sync, file_path, filename, recipient_email, kindle)
    except Exception:
        logger.exception("envoi email echoue vers %s (kindle=%s, fichier=%s)", recipient_email, kindle, filename)
        raise
    logger.info("email envoye vers %s (kindle=%s, fichier=%s)", recipient_email, kindle, filename)
