"""Import de bibliotheque : recupere un fichier (upload ou connecteur),
cree/retrouve la `Source` correspondante, et enregistre le `LibraryItem`.

La conversion de format proprement dite vit dans `services/converters.py` ;
ce module orchestre fetch + persistance, il ne convertit rien lui-meme (M0
n'exige pas de convertir a l'import : la conversion a lieu a la demande,
lors d'une livraison, cf. `api/deliveries.py`).
"""

import logging
import shutil
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.config import get_settings
from ferry_agent.connectors import Result
from ferry_agent.connectors.registry import get_connector
from ferry_agent.models import LibraryItem, Source, SourceType

logger = logging.getLogger(__name__)


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
    db: AsyncSession, user_id: uuid.UUID, source_name: str, result_id: str
) -> LibraryItem:
    """Recupere un resultat de recherche via son connecteur et l'ajoute a la bibliotheque."""
    connector = get_connector(source_name)
    if connector is None:
        raise ValueError(f"connecteur inconnu: {source_name}")

    fetched_path = await connector.fetch(result_id)
    fetched = Path(fetched_path)

    dest = _library_storage_path(fetched.name)
    shutil.move(str(fetched), str(dest))

    source_type = SourceType(source_name)
    source = await _get_or_create_source(db, user_id, source_type)

    item = LibraryItem(
        user_id=user_id,
        title=fetched.stem,
        author="",
        source_id=source.id,
        original_format=dest.suffix.lstrip(".") or "epub",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def import_from_upload(
    db: AsyncSession, user_id: uuid.UUID, filename: str, content: bytes, title: str | None = None
) -> LibraryItem:
    """Persiste un fichier deja fourni par l'utilisateur (upload) dans la bibliotheque."""
    dest = _library_storage_path(filename)
    dest.write_bytes(content)

    source_type = SourceType.upload
    source = await _get_or_create_source(db, user_id, source_type)

    item = LibraryItem(
        user_id=user_id,
        title=title or Path(filename).stem,
        author="",
        source_id=source.id,
        original_format=Path(filename).suffix.lstrip(".") or "epub",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def search_all(query: str) -> list[Result]:
    """Interroge tous les connecteurs cherchables et fusionne les resultats."""
    from ferry_agent.connectors.registry import get_search_connectors

    results: list[Result] = []
    for connector in get_search_connectors():
        try:
            results.extend(await connector.search(query))
        except Exception:  # pragma: no cover - resilience reseau
            logger.exception("recherche echouee pour le connecteur %s", getattr(connector, "name", connector))
    return results
