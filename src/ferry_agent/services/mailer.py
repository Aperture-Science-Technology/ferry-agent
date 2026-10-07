"""Envoi d'ebooks par email (Send-to-Kindle et autres adresses).

L'envoi SMTP est synchrone (`smtplib`) et delegue a un thread via
`run_in_executor` pour ne pas bloquer la boucle asyncio. Si SMTP n'est pas
configure (`smtp_user`/`smtp_password` absents), `is_configured()` retourne
False et l'appelant doit s'en servir pour eviter d'appeler `send_file`
plutot que de planter au premier envoi.

TLS : toujours un contexte verifiant (`ssl.create_default_context()`), jamais
le defaut smtplib (`_create_stdlib_context` = CERT_NONE).

La valeur retournee par `send_file` / `_send_sync` est une trace d'acceptation
par le relais — jamais une preuve de livraison sur la Kindle.
"""

from __future__ import annotations

import asyncio
import hashlib
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


def is_transient_error(exc: BaseException) -> bool:
    """Vrai si l'erreur SMTP/reseau merite un nouvel essai.

    Les 4xx et les deconnexions/timeouts sont transitoires. Un 5xx,
    ``MailerNotConfigured`` et ``MessageTooLargeForRelay`` ne le sont jamais.
    ``SMTPException`` herite de ``OSError`` en Python 3 : on exclut donc les
    erreurs SMTP non classees 4xx avant le filet ``OSError``.
    """
    if isinstance(exc, (MailerNotConfigured, MessageTooLargeForRelay)):
        return False
    code = getattr(exc, "smtp_code", None)
    if isinstance(code, int):
        return 400 <= code < 500
    if isinstance(
        exc,
        (
            smtplib.SMTPServerDisconnected,
            smtplib.SMTPConnectError,
            smtplib.SMTPHeloError,
        ),
    ):
        return True
    if isinstance(exc, smtplib.SMTPException):
        return False
    return isinstance(exc, (TimeoutError, ConnectionError, OSError))


def encoded_size_bound(raw_bytes: int) -> int:
    """Majorant de la taille du message une fois encode en base64."""
    return int(raw_bytes * _MIME_OVERHEAD_FACTOR)


def _idempotency_key(recipient_email: str, filename: str, size_bytes: int) -> str:
    payload = f"{recipient_email}:{filename}:{size_bytes}"
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


def build_message(
    file_path: str, filename: str, recipient_email: str, *, kindle: bool, title: str | None = None
) -> EmailMessage:
    settings = get_settings()
    sender = settings.smtp_from or settings.smtp_user
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient_email
    clean_title = " ".join((title or "").split())
    message["Subject"] = (clean_title or "Votre document") if kindle else f"Ferry Agent : {filename}"
    message["Date"] = formatdate(localtime=False)
    domain = (sender or "").rpartition("@")[2] or "ferry-agent.invalid"
    message["Message-ID"] = make_msgid(domain=domain)
    if settings.smtp_reply_to:
        message["Reply-To"] = settings.smtp_reply_to
    message.set_content("Document envoye par Ferry Agent.")

    content_type = content_type_for_filename(filename)
    maintype, _, subtype = content_type.partition("/")
    file_bytes = Path(file_path).read_bytes()
    message.add_attachment(
        file_bytes,
        maintype=maintype,
        subtype=subtype or "octet-stream",
        filename=filename,
    )
    if settings.smtp_idempotency_header:
        message[settings.smtp_idempotency_header] = _idempotency_key(recipient_email, filename, len(file_bytes))
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


def _send_sync(file_path: str, filename: str, recipient_email: str, kindle: bool, title: str | None = None) -> str:
    settings = get_settings()
    message = build_message(file_path, filename, recipient_email, kindle=kindle, title=title)
    raw_size = len(message.as_bytes())
    limit = min(settings.smtp_max_message_bytes, settings.amazon_send_to_kindle_max_bytes)
    if raw_size > limit:
        raise MessageTooLargeForRelay(
            f"Message encode de {raw_size // 1024} Ko > plafond {limit // 1024} Ko : "
            "utilisez le telechargement navigateur (tier C) pour ce livre."
        )
    with _connect() as smtp:
        smtp.login(settings.smtp_user, settings.smtp_password)
        refused = smtp.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
    message_id = message["Message-ID"] or ""
    return f"{settings.smtp_host}:{settings.smtp_port} accepted {message_id}"


async def send_file(
    file_path: str, filename: str, recipient_email: str, kindle: bool = False, *, title: str | None = None
) -> str | None:
    if not is_configured():
        raise MailerNotConfigured("SMTP non configure (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)")

    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, _send_sync, file_path, filename, recipient_email, kindle, title)
    except Exception:
        logger.exception("envoi email echoue vers %s (kindle=%s, fichier=%s)", recipient_email, kindle, filename)
        raise
    logger.info("email envoye vers %s (kindle=%s, fichier=%s)", recipient_email, kindle, filename)
    return result
