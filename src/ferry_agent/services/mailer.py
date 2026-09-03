"""Envoi d'ebooks par email (Send-to-Kindle et autres adresses).

L'envoi SMTP est synchrone (`smtplib`) et delegue a un thread via
`run_in_executor` pour ne pas bloquer la boucle asyncio. Si SMTP n'est pas
configure (`smtp_user`/`smtp_password` absents), `is_configured()` retourne
False et l'appelant doit s'en servir pour eviter d'appeler `send_file`
plutot que de planter au premier envoi.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path

from ferry_agent.config import get_settings
from ferry_agent.services.file_validation import content_type_for_filename

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _send_sync(file_path: str, filename: str, recipient_email: str, kindle: bool) -> None:
    settings = get_settings()
    sender = settings.smtp_from or settings.smtp_user

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient_email
    # Send-to-Kindle route sur le sujet "convert" pour declencher la
    # conversion cote Amazon si necessaire.
    message["Subject"] = "convert" if kindle else f"Ferry Agent : {filename}"
    message.set_content("Envoye par Ferry Agent.")

    content_type = content_type_for_filename(filename)
    maintype, _, subtype = content_type.partition("/")
    data = Path(file_path).read_bytes()
    message.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream", filename=filename)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


async def send_file(file_path: str, filename: str, recipient_email: str, kindle: bool = False) -> None:
    if not is_configured():
        raise RuntimeError("SMTP non configure (SMTP_HOST/SMTP_USER/SMTP_PASSWORD manquants)")

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _send_sync, file_path, filename, recipient_email, kindle)
    except Exception:
        logger.exception("envoi email echoue vers %s (kindle=%s, fichier=%s)", recipient_email, kindle, filename)
        raise
    logger.info("email envoye vers %s (kindle=%s, fichier=%s)", recipient_email, kindle, filename)
