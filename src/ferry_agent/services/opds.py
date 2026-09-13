"""Catalogue OPDS 1.2 sortant + gestion des jetons.

Generation Atom via `xml.etree.ElementTree` (stdlib) : les textes et
attributs sont echappes par ET (equivalent systematique de
`html.escape` cote tier C). Le secret du jeton n'est jamais persiste —
seul le hash SHA-256 (voir `hash_secret`) l'est.
"""

from __future__ import annotations

import secrets
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import quote, urlencode, urlparse
from xml.dom import minidom

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import hash_secret
from ferry_agent.config import get_settings
from ferry_agent.models import LibraryItem, OpdsToken
from ferry_agent.services.file_validation import content_type_for_filename

ATOM_NS = "http://www.w3.org/2005/Atom"
OPDS_NS = "http://opds-spec.org/2010/catalog"
DCTERMS_NS = "http://purl.org/dc/terms/"

NAV_CONTENT_TYPE = "application/atom+xml;profile=opds-catalog;kind=navigation"
ACQ_CONTENT_TYPE = "application/atom+xml;profile=opds-catalog;kind=acquisition"
OPENSEARCH_CONTENT_TYPE = "application/opensearchdescription+xml"

PAGE_SIZE = 25

ET.register_namespace("", ATOM_NS)
ET.register_namespace("opds", OPDS_NS)
ET.register_namespace("dcterms", DCTERMS_NS)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _el(tag: str, parent: ET.Element | None = None, **attrs: str) -> ET.Element:
    """Cree un element Atom ; les valeurs texte/attrs sont echappees par ET."""
    node = ET.Element(f"{{{ATOM_NS}}}{tag}", {k: v for k, v in attrs.items() if v is not None})
    if parent is not None:
        parent.append(node)
    return node


def _text(parent: ET.Element, tag: str, value: str, **attrs: str) -> ET.Element:
    node = _el(tag, parent, **attrs)
    node.text = value
    return node


def serialize_feed(root: ET.Element) -> bytes:
    """Serialise en XML UTF-8 avec declaration (pretty-print leger)."""
    rough = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    try:
        return minidom.parseString(rough).toprettyxml(indent="  ", encoding="utf-8")
    except Exception:
        return rough


def catalog_base_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.public_base_url.rstrip('/')}/opds/{token}"


def public_catalog_url(token: str) -> str:
    return catalog_base_url(token)


async def create_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    label: str,
) -> tuple[OpdsToken, str]:
    raw = secrets.token_urlsafe(32)
    row = OpdsToken(
        user_id=user_id,
        label=label.strip() or "Liseuse",
        token_hash=hash_secret(raw),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row, raw


async def list_tokens(db: AsyncSession, user_id: uuid.UUID) -> list[OpdsToken]:
    result = await db.execute(
        select(OpdsToken)
        .where(OpdsToken.user_id == user_id, OpdsToken.revoked_at.is_(None))
        .order_by(OpdsToken.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_token(db: AsyncSession, token_row: OpdsToken) -> None:
    token_row.revoked_at = _utcnow()
    await db.commit()


async def resolve_token(db: AsyncSession, raw_token: str) -> OpdsToken | None:
    """Retourne le jeton actif ou None (inconnu / revoque → 404 cote route)."""
    result = await db.execute(
        select(OpdsToken).where(
            OpdsToken.token_hash == hash_secret(raw_token),
            OpdsToken.revoked_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    row.last_used_at = _utcnow()
    await db.commit()
    await db.refresh(row)
    return row


def _link(
    parent: ET.Element,
    *,
    rel: str,
    href: str,
    type_: str | None = None,
    title: str | None = None,
) -> None:
    attrs: dict[str, str] = {"rel": rel, "href": href}
    if type_:
        attrs["type"] = type_
    if title:
        attrs["title"] = title
    _el("link", parent, **attrs)


def _feed_shell(
    *,
    feed_id: str,
    title: str,
    self_href: str,
    token: str,
    kind: str = "navigation",
) -> ET.Element:
    feed = _el("feed")
    _text(feed, "id", feed_id)
    _text(feed, "title", title)
    _text(feed, "updated", _utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
    author = _el("author", feed)
    _text(author, "name", "Ferry Agent")
    content_type = NAV_CONTENT_TYPE if kind == "navigation" else ACQ_CONTENT_TYPE
    _link(feed, rel="self", href=self_href, type_=content_type)
    _link(feed, rel="start", href=catalog_base_url(token), type_=NAV_CONTENT_TYPE)
    _link(
        feed,
        rel="search",
        href=f"{catalog_base_url(token)}/opensearch.xml",
        type_=OPENSEARCH_CONTENT_TYPE,
    )
    return feed


def build_root_navigation(token: str) -> bytes:
    base = catalog_base_url(token)
    feed = _feed_shell(
        feed_id=f"{base}/",
        title="Bibliothèque Ferry",
        self_href=base,
        token=token,
        kind="navigation",
    )
    for entry_id, title, href, kind in (
        ("recent", "Ajouts récents", f"{base}/recent", "acquisition"),
        ("authors", "Par auteur", f"{base}/authors", "navigation"),
        ("all", "Tout", f"{base}/all", "acquisition"),
    ):
        entry = _el("entry", feed)
        _text(entry, "id", f"{base}/{entry_id}")
        _text(entry, "title", title)
        _text(entry, "updated", _utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
        ctype = ACQ_CONTENT_TYPE if kind == "acquisition" else NAV_CONTENT_TYPE
        _link(entry, rel="subsection", href=href, type_=ctype, title=title)
    return serialize_feed(feed)


def build_authors_navigation(token: str, authors: list[str]) -> bytes:
    base = catalog_base_url(token)
    self_href = f"{base}/authors"
    feed = _feed_shell(
        feed_id=self_href,
        title="Par auteur",
        self_href=self_href,
        token=token,
        kind="navigation",
    )
    for author in authors:
        if not author:
            continue
        entry = _el("entry", feed)
        href = f"{base}/author?{urlencode({'name': author})}"
        _text(entry, "id", f"{base}/author/{quote(author, safe='')}")
        _text(entry, "title", author)
        _text(entry, "updated", _utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
        _link(entry, rel="subsection", href=href, type_=ACQ_CONTENT_TYPE, title=author)
    return serialize_feed(feed)


def _cover_media_type(cover_url: str) -> str:
    """Devine le type image annonce dans le flux (le endpoint /cover sert le vrai MIME)."""
    candidate = cover_url
    if cover_url.startswith("http://") or cover_url.startswith("https://"):
        candidate = urlparse(cover_url).path or cover_url
    guessed = content_type_for_filename(candidate)
    if guessed.startswith("image/"):
        return guessed
    return "image/jpeg"


def _like_pattern(query: str) -> str:
    """Escape %/_/\\ pour un ILIKE litteral (les jokers utilisateur restent du texte)."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _acquisition_entry(feed: ET.Element, item: LibraryItem, token: str) -> None:
    base = catalog_base_url(token)
    entry = _el("entry", feed)
    _text(entry, "id", f"urn:uuid:{item.id}")
    _text(entry, "title", item.title or "Sans titre")
    _text(entry, "updated", (item.added_at or _utcnow()).strftime("%Y-%m-%dT%H:%M:%SZ"))
    if item.author:
        author = _el("author", entry)
        _text(author, "name", item.author)
    if item.description:
        _text(entry, "summary", item.description)
    if item.language:
        lang = ET.SubElement(entry, f"{{{DCTERMS_NS}}}language")
        lang.text = item.language
    if item.publisher:
        pub = ET.SubElement(entry, f"{{{DCTERMS_NS}}}publisher")
        pub.text = item.publisher

    filename = item.storage_path.rsplit("/", 1)[-1] if item.storage_path else f"book.{item.original_format}"
    media_type = content_type_for_filename(filename)
    _link(
        entry,
        rel="http://opds-spec.org/acquisition",
        href=f"{base}/download/{item.id}",
        type_=media_type,
        title="Télécharger",
    )
    if item.cover_url:
        image_type = _cover_media_type(item.cover_url)
        _link(
            entry,
            rel="http://opds-spec.org/image",
            href=f"{base}/cover/{item.id}",
            type_=image_type,
        )
        _link(
            entry,
            rel="http://opds-spec.org/image/thumbnail",
            href=f"{base}/cover/{item.id}",
            type_=image_type,
        )


def _pagination_links(
    feed: ET.Element,
    *,
    self_href: str,
    page: int,
    total: int,
    page_size: int,
    query_extra: dict[str, str] | None = None,
) -> None:
    """Ajoute rel=next/previous selon page courante."""
    from urllib.parse import urlsplit, urlunsplit, parse_qsl

    parts = urlsplit(self_href)
    base_qs = dict(parse_qsl(parts.query, keep_blank_values=True))
    if query_extra:
        base_qs.update(query_extra)

    def href_for(p: int) -> str:
        qs = {**base_qs, "page": str(p)}
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(qs), parts.fragment))

    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    if page > 1:
        _link(feed, rel="previous", href=href_for(page - 1), type_=ACQ_CONTENT_TYPE)
    if page < total_pages:
        _link(feed, rel="next", href=href_for(page + 1), type_=ACQ_CONTENT_TYPE)


def build_acquisition_feed(
    *,
    token: str,
    title: str,
    self_href: str,
    items: list[LibraryItem],
    page: int,
    total: int,
    query_extra: dict[str, str] | None = None,
) -> bytes:
    feed = _feed_shell(
        feed_id=self_href,
        title=title,
        self_href=self_href if "page=" in self_href else f"{self_href}{'&' if '?' in self_href else '?'}page={page}",
        token=token,
        kind="acquisition",
    )
    _pagination_links(
        feed,
        self_href=self_href.split("?")[0] if "?" in self_href else self_href,
        page=page,
        total=total,
        page_size=PAGE_SIZE,
        query_extra=query_extra,
    )
    for item in items:
        _acquisition_entry(feed, item, token)
    return serialize_feed(feed)


def build_opensearch_description(token: str) -> bytes:
    base = catalog_base_url(token)
    root = ET.Element(
        "OpenSearchDescription",
        {"xmlns": "http://a9.com/-/spec/opensearch/1.1/"},
    )
    short = ET.SubElement(root, "ShortName")
    short.text = "Ferry"
    desc = ET.SubElement(root, "Description")
    desc.text = "Rechercher dans votre bibliothèque Ferry"
    ET.SubElement(
        root,
        "Url",
        {
            "type": ACQ_CONTENT_TYPE,
            "template": f"{base}/search?q={{searchTerms}}",
        },
    )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


async def count_items(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    author: str | None = None,
    query: str | None = None,
) -> int:
    stmt = select(func.count()).select_from(LibraryItem).where(LibraryItem.user_id == user_id)
    if author is not None:
        stmt = stmt.where(LibraryItem.author == author)
    if query:
        pattern = _like_pattern(query)
        stmt = stmt.where(
            or_(
                LibraryItem.title.ilike(pattern, escape="\\"),
                LibraryItem.author.ilike(pattern, escape="\\"),
            )
        )
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def list_items_page(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    page: int,
    page_size: int = PAGE_SIZE,
    order_by_added: bool = False,
    author: str | None = None,
    query: str | None = None,
) -> list[LibraryItem]:
    offset = max(0, (page - 1) * page_size)
    stmt = select(LibraryItem).where(LibraryItem.user_id == user_id)
    if author is not None:
        stmt = stmt.where(LibraryItem.author == author)
    if query:
        pattern = _like_pattern(query)
        stmt = stmt.where(
            or_(
                LibraryItem.title.ilike(pattern, escape="\\"),
                LibraryItem.author.ilike(pattern, escape="\\"),
            )
        )
    if order_by_added:
        stmt = stmt.order_by(LibraryItem.added_at.desc())
    else:
        stmt = stmt.order_by(LibraryItem.title.asc())
    stmt = stmt.offset(offset).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_distinct_authors(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(LibraryItem.author)
        .where(LibraryItem.user_id == user_id, LibraryItem.author != "")
        .distinct()
        .order_by(LibraryItem.author.asc())
    )
    return [row[0] for row in result.all() if row[0]]
