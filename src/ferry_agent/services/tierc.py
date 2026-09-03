"""Mini-catalogue HTTP + code court (tier C).

Pour les liseuses a navigateur embarque ancien (Kobo/Tolino) qui ne
peuvent pas recevoir d'email ni utiliser une app native : l'utilisateur
tape un code court dans le navigateur de la liseuse, qui affiche une page
HTML minimale (pas de JS, CSS inline basique) avec un lien de
telechargement direct du fichier.
"""

import html
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.config import get_settings
from ferry_agent.models import ShortCode

CODE_LENGTH = 8
# Alphabet sans caracteres ambigus (0/O, 1/I/L) : le code est retape a la
# main sur une liseuse, souvent au clavier virtuel.
CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1IL")
DEFAULT_TTL_MINUTES = 1440
DEFAULT_DOWNLOADS_LEFT = 1
_MAX_CODE_ATTEMPTS = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_short_code(length: int = CODE_LENGTH) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


async def _unique_code(db: AsyncSession) -> str:
    for _ in range(_MAX_CODE_ATTEMPTS):
        code = generate_short_code()
        result = await db.execute(select(ShortCode).where(ShortCode.code == code))
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError("impossible de generer un code court unique")


async def create_download_session(
    db: AsyncSession,
    job_id: uuid.UUID,
    downloads_left: int | None = DEFAULT_DOWNLOADS_LEFT,
    ttl_minutes: int = DEFAULT_TTL_MINUTES,
) -> tuple[ShortCode, str]:
    code = await _unique_code(db)
    short_code = ShortCode(
        code=code,
        delivery_job_id=job_id,
        expires_at=_utcnow() + timedelta(minutes=ttl_minutes),
        downloads_left=downloads_left,
    )
    db.add(short_code)
    await db.commit()
    await db.refresh(short_code)

    settings = get_settings()
    url = f"{settings.public_base_url.rstrip('/')}/c/{code}"
    return short_code, url


async def get_valid_short_code(db: AsyncSession, code: str) -> ShortCode | None:
    """Recupere un code court valide (existe, non expire, telechargements restants).

    Casse insensible : le code est toujours normalise en majuscules.
    """
    normalized = code.strip().upper()
    result = await db.execute(select(ShortCode).where(ShortCode.code == normalized))
    short_code = result.scalar_one_or_none()
    if short_code is None:
        return None
    if short_code.expires_at <= _utcnow():
        return None
    if short_code.downloads_left is not None and short_code.downloads_left <= 0:
        return None
    return short_code


def render_page(code: str, title: str, author: str) -> str:
    """HTML minimal : pas de JS/ESM, CSS inline basique, compatible vieux Chromium."""
    safe_title = html.escape(title or "Livre")
    safe_author = html.escape(author or "")
    safe_code = html.escape(code)
    author_row = f"<tr><td>{safe_author}</td></tr>" if safe_author else ""
    return (
        "<!DOCTYPE html>\n"
        "<html>\n"
        "<head>\n"
        '<meta charset="utf-8">\n'
        f"<title>{safe_title}</title>\n"
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "</head>\n"
        '<body style="font-family: sans-serif; margin: 24px; color: #111111; background: #ffffff;">\n'
        '<table width="100%" cellpadding="8" cellspacing="0" border="0">\n'
        f"<tr><td><h1>{safe_title}</h1></td></tr>\n"
        f"{author_row}\n"
        f"<tr><td>Code : {safe_code}</td></tr>\n"
        f'<tr><td><a href="/c/{safe_code}/download">Telecharger</a></td></tr>\n'
        "</table>\n"
        "</body>\n"
        "</html>\n"
    )


def render_missing() -> str:
    return (
        "<!DOCTYPE html>\n"
        "<html>\n"
        "<head>\n"
        '<meta charset="utf-8">\n'
        "<title>Introuvable</title>\n"
        "</head>\n"
        '<body style="font-family: sans-serif; margin: 24px; color: #111111; background: #ffffff;">\n'
        "<h1>Code introuvable ou expire</h1>\n"
        "<p>Ce lien de telechargement n'est plus valide.</p>\n"
        "</body>\n"
        "</html>\n"
    )
