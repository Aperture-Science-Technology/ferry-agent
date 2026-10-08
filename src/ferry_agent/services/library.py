"""Import de bibliotheque : recupere un fichier (upload ou connecteur),
cree/retrouve la `Source` correspondante, et enregistre le `LibraryItem`.

La conversion de format proprement dite vit dans `services/converters.py` ;
ce module orchestre fetch + persistance, il ne convertit rien lui-meme (M0
n'exige pas de convertir a l'import : la conversion a lieu a la demande,
lors d'une livraison, cf. `api/deliveries.py`).
"""

import asyncio
import logging
import re
import shutil
import unicodedata
import uuid
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.config import get_settings
from ferry_agent.connectors import Result
from ferry_agent.connectors.registry import get_connector
from ferry_agent.models import LibraryItem, Source, SourceType
from ferry_agent.services.book_metadata import clean_release_title, extract_epub, extract_pdf, is_release_title
from ferry_agent.services.covers import validate_cover_url
from ferry_agent.services.errors import QUOTA_EXCEEDED_MESSAGE, QuotaExceededError

logger = logging.getLogger(__name__)


def user_facing_filename(item: LibraryItem, target_format: str) -> str:
    """Deterministic public name; storage and conversion paths remain private."""
    def clean(value: str | None) -> str:
        value = ''.join(' ' if c.isspace() else c for c in (value or ''))
        value = ''.join(c for c in value if c not in '/\\' and not unicodedata.category(c).startswith('C'))
        return ' '.join(value.split()).strip(' .')

    title, author = clean(item.title), clean(item.author)
    stem = f'{author} - {title}' if title and author else title or 'Document'
    extension = re.sub(r'[^a-z0-9]', '', target_format.lower())[:10] or 'epub'
    return f'{stem[:119 - len(extension)].rstrip(" .")}.{extension}'


def enrich_from_file(item: LibraryItem, *, fallback_title: bool = False) -> None:
    """Fill empty metadata; a release-name placeholder is not a curated title."""
    fields, cover = {}, None
    if item.original_format.lower() == "epub":
        fields, cover = extract_epub(Path(item.storage_path))
    elif item.original_format.lower() == "pdf":
        fields = extract_pdf(Path(item.storage_path))
    if fallback_title or not (item.title or '').strip():
        item.title = fields.get('title') or clean_release_title(item.title or '') or item.title
    for name, value in fields.items():
        current = getattr(item, name)
        if name != 'title' and (not current or isinstance(current, str) and not current.strip()):
            setattr(item, name, value)
    if cover and not item.cover_url:
        content, extension = cover
        Path(item.storage_path + '.cover' + extension).write_bytes(content)
        item.id = item.id or uuid.uuid4()
        item.cover_url = f'/api/v1/covers/{item.id}'


async def used_storage_bytes(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Somme des `size_bytes` deja comptes pour l'utilisateur (NULL = 0)."""
    result = await db.execute(
        select(func.coalesce(func.sum(LibraryItem.size_bytes), 0)).where(
            LibraryItem.user_id == user_id
        )
    )
    return int(result.scalar_one_or_none() or 0)


async def ensure_storage_quota(
    db: AsyncSession,
    user_id: uuid.UUID,
    incoming_bytes: int,
    *,
    quota_bytes: int | None = None,
) -> None:
    """Refuse l'ajout si `used + incoming` depasse le plafond utilisateur."""
    quota = (
        quota_bytes
        if quota_bytes is not None
        else get_settings().user_storage_quota_bytes
    )
    used = await used_storage_bytes(db, user_id)
    if used + incoming_bytes > quota:
        raise QuotaExceededError(QUOTA_EXCEEDED_MESSAGE)


async def _get_or_create_source(db: AsyncSession, user_id: uuid.UUID, source_type: SourceType) -> Source:
    result = await db.execute(
        select(Source).where(Source.user_id == user_id, Source.type == source_type)
    )
    source = result.scalar_one_or_none()
    if source is None:
        source = Source(user_id=user_id, type=source_type, config={})
        db.add(source)
        await db.flush()
    return source


def _library_storage_path(filename: str) -> Path:
    settings = get_settings()
    storage_dir = Path(settings.library_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir / f"{uuid.uuid4()}_{filename}"


async def import_from_connector(
    db: AsyncSession,
    user_id: uuid.UUID,
    source_name: str,
    result_id: str,
    *,
    metadata: dict | None = None,
) -> LibraryItem:
    """Recupere un resultat de recherche via son connecteur et l'ajoute a la bibliotheque.

    `metadata` est le resultat de recherche (tel que renvoye par le connecteur
    a l'appelant, ex. `Result.model_dump()` cote API) : quand ses champs sont
    presents et non vides, ils completent l'item persiste (auteur, couverture,
    description, langue, nombre de pages).

    Note : en production `temp_dir` et `library_storage_dir` sont des volumes
    distincts (`ferry_tmp` / `ferry_library`). Le `shutil.move` ci-dessous
    devient alors une copie inter-filesystem (quelques Mo), plus lente et non
    atomique — acceptable pour la taille des ebooks.
    """
    connector = get_connector(source_name)
    if connector is None:
        raise ValueError(f"connecteur inconnu: {source_name}")

    source_ref = f"{source_name}:{result_id}"
    existing_result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.user_id == user_id,
            LibraryItem.source_ref == source_ref,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        return existing

    fetched_path = await connector.fetch(result_id)
    fetched = Path(fetched_path)
    incoming_bytes = fetched.stat().st_size
    try:
        await ensure_storage_quota(db, user_id, incoming_bytes)
    except QuotaExceededError:
        fetched.unlink(missing_ok=True)
        raise

    dest = _library_storage_path(fetched.name)
    shutil.move(str(fetched), str(dest))

    source_type = SourceType(source_name)
    source = await _get_or_create_source(db, user_id, source_type)

    metadata = metadata or {}
    item = LibraryItem(
        user_id=user_id,
        title=metadata.get("title") or fetched.stem,
        author=metadata.get("author") or "",
        cover_url=validate_cover_url(metadata.get("cover_url")),
        description=metadata.get("description") or None,
        language=metadata.get("language") or None,
        page_count=metadata.get("page_count") or None,
        isbn=metadata.get("isbn") or None,
        publisher=metadata.get("publisher") or None,
        published_year=metadata.get("published_year") or None,
        source_id=source.id,
        source_ref=source_ref,
        original_format=dest.suffix.lstrip(".") or "epub",
        storage_path=str(dest),
        size_bytes=dest.stat().st_size,
    )
    enrich_from_file(
        item, fallback_title=not bool(metadata.get("title")) or is_release_title(item.title)
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def import_from_upload(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    content: bytes,
    title: str | None = None,
    detected_format: str | None = None,
) -> LibraryItem:
    """Persiste un fichier deja fourni par l'utilisateur (upload) dans la bibliotheque."""
    dest = _library_storage_path(filename)
    dest.write_bytes(content)

    source_type = SourceType.upload
    source = await _get_or_create_source(db, user_id, source_type)

    fmt = detected_format
    if fmt == "mobi" and Path(filename).suffix.lower() == ".azw3":
        fmt = "azw3"
    original_format = fmt if fmt else (Path(filename).suffix.lstrip(".") or "epub")

    item = LibraryItem(
        user_id=user_id,
        title=title or Path(filename).stem,
        author="",
        source_id=source.id,
        original_format=original_format,
        storage_path=str(dest),
        size_bytes=len(content),
    )
    enrich_from_file(item, fallback_title=not bool(title))
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def import_from_gateway(
    db: AsyncSession,
    user_id: uuid.UUID,
    gateway_id: uuid.UUID,
    job_id: uuid.UUID,
    filename: str,
    content: bytes,
    detected_format: str,
    metadata: dict,
) -> LibraryItem:
    """Persiste un ebook relayé et conserve sa provenance dans LibraryItem.source_ref."""
    source_ref = f"gateway:{gateway_id}:{job_id}"
    existing_result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.user_id == user_id,
            LibraryItem.source_ref == source_ref,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        return existing

    await ensure_storage_quota(db, user_id, len(content))
    safe_name = Path(filename).name or f"gateway-book.{detected_format}"
    dest = _library_storage_path(safe_name)
    dest.write_bytes(content)

    source = await _get_or_create_source(db, user_id, SourceType.torrent_gateway)

    item = LibraryItem(
        user_id=user_id,
        title=metadata.get("title") or Path(safe_name).stem,
        author=metadata.get("author") or "",
        cover_url=validate_cover_url(metadata.get("cover_url")),
        description=metadata.get("description") or None,
        language=metadata.get("language") or None,
        page_count=metadata.get("page_count") or None,
        isbn=metadata.get("isbn") or None,
        publisher=metadata.get("publisher") or None,
        published_year=metadata.get("published_year") or None,
        source_id=source.id,
        source_ref=source_ref,
        original_format=detected_format,
        storage_path=str(dest),
        size_bytes=len(content),
    )
    enrich_from_file(
        item, fallback_title=not bool(metadata.get("title")) or is_release_title(item.title)
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_library_item(db: AsyncSession, item: LibraryItem) -> None:
    """Supprime le fichier stocke et l'enregistrement `LibraryItem`.

    Ne touche pas aux `DeliveryJob` lies : l'historique de livraisons est
    conserve meme apres suppression du livre (cf. api/books.py).
    """
    path = Path(item.storage_path)
    if path.exists():
        path.unlink(missing_ok=True)
    else:
        logger.warning("fichier introuvable lors de la suppression: %s", path)
    for extension in (".png", ".jpg"):
        Path(item.storage_path + ".cover" + extension).unlink(missing_ok=True)
    await db.delete(item)
    await db.commit()


async def search_all(query: str, *, exclude: set[str] | None = None) -> list[Result]:
    """Interroge les connecteurs cherchables (hors `exclude`) et fusionne les resultats.

    Un echec sur un connecteur est isole (warning) : les autres continuent
    a contribuer leurs resultats.
    """
    from ferry_agent.connectors.registry import get_search_connectors

    exclude = exclude or set()
    async def search_connector(connector) -> list[Result]:
        name = getattr(connector, "name", connector)
        try:
            return await connector.search(query)
        except Exception as exc:
            logger.warning("recherche echouee pour le connecteur %s: %s", name, exc)
            return []

    batches = await asyncio.gather(
        *(search_connector(connector) for connector in get_search_connectors()
          if getattr(connector, "name", connector) not in exclude)
    )
    return [result for batch in batches for result in batch]
