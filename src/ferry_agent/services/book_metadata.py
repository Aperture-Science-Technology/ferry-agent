"""Read book metadata without introducing dependencies.

EPUB uses bounded standard-library ZIP/XML reads. PDF uses the PyMuPDF
already required by the conversion service. Unknown fields remain empty.
"""

import posixpath
import re
import zipfile
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree as ET

XML_LIMIT = 1024 * 1024
COVER_LIMIT = 2 * 1024 * 1024
DC = "{http://purl.org/dc/elements/1.1/}"
OPF = "{http://www.idpf.org/2007/opf}"


def clean_release_title(value: str) -> str:
    value = re.sub(r"\.(epub|pdf|mobi|azw3)$", "", value, flags=re.I)
    value = re.sub(r"\[(?:EPUB|PDF|MOBI|AZW3|FRENCH|ENGLISH|FR|EN)\]", " ", value, flags=re.I)
    value = re.sub(r"-(?:[A-Za-z0-9]+)\s*$", "", value)
    value = re.sub(r"\b(?:FRENCH|ENGLISH)\b", " ", value, flags=re.I)
    return " ".join(value.replace(".", " ").split()).strip(" -_")


def is_release_title(value: str) -> bool:
    tagged = re.search(r"\[(?:EPUB|PDF|FRENCH|ENGLISH)\]", value, re.I)
    dotted = not any(c.isspace() for c in value) and value.count(".") >= 2
    return bool(tagged or dotted)


def _read(archive: zipfile.ZipFile, name: str, limit: int) -> bytes:
    name = posixpath.normpath(unquote(name))
    if name.startswith(("/", "../")) or "\\" in name:
        raise ValueError("unsafe EPUB member")
    info = archive.getinfo(name)
    if info.file_size > limit:
        raise ValueError("EPUB member too large")
    with archive.open(info) as member:
        content = member.read(limit + 1)
    if len(content) > limit:
        raise ValueError("EPUB member too large")
    return content


def _xml(archive: zipfile.ZipFile, name: str) -> ET.Element:
    raw = _read(archive, name, XML_LIMIT)
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("EPUB XML entities are unsupported")
    return ET.fromstring(raw)


def extract_epub(path: Path) -> tuple[dict, tuple[bytes, str] | None]:
    """Malformed/unsupported files never prevent an otherwise valid import."""
    fields: dict = {}
    cover = None
    try:
        with zipfile.ZipFile(path) as archive:
            container = _xml(archive, "META-INF/container.xml")
            rootfile = container.find(".//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile")
            if rootfile is None:
                return fields, cover
            opf_path = rootfile.attrib["full-path"]
            package = _xml(archive, opf_path)
            metadata = package.find(f"{OPF}metadata")
            if metadata is None:
                return fields, cover
            for field, tag in [
                ("title", "title"),
                ("author", "creator"),
                ("language", "language"),
                ("publisher", "publisher"),
            ]:
                value = " ".join((metadata.findtext(f"{DC}{tag}") or "").split())
                if value:
                    fields[field] = value
            date = metadata.findtext(f"{DC}date") or ""
            if re.match(r"^\d{4}(?:-|$)", date):
                fields["published_year"] = int(date[:4])
            for identifier in metadata.findall(f"{DC}identifier"):
                value = (identifier.text or "").strip()
                compact = re.sub(r"[\s-]", "", re.sub(r"^urn:isbn:", "", value, flags=re.I))
                if re.fullmatch(r"(?:97[89]\d{10}|\d{9}[\dXx])", compact):
                    fields["isbn"] = compact
                    break
            # Only explicit publisher extent in pages, never reader-dependent pagination.
            for node in metadata.findall(f"{OPF}meta"):
                if node.get("property") == "dcterms:extent":
                    extent = re.fullmatch(r"\s*(\d+)\s+(?:pages|p\.)\s*", node.text or "", re.I)
                    if extent and 0 < int(extent[1]) <= 2147483647:
                        fields["page_count"] = int(extent[1])
                        break
            legacy = next(
                (node.get("content") for node in metadata.findall(f"{OPF}meta") if node.get("name") == "cover"), None
            )
            manifest = package.findall(f"{OPF}manifest/{OPF}item")
            candidate = next((node for node in manifest if "cover-image" in node.get("properties", "").split()), None)
            if candidate is None and legacy:
                candidate = next((node for node in manifest if node.get("id") == legacy), None)
            if candidate is not None:
                name = posixpath.join(posixpath.dirname(opf_path), candidate.attrib["href"])
                content = _read(archive, name, COVER_LIMIT)
                # Raster only; embedded active SVG/HTML is never served on our origin.
                if content.startswith(b"\x89PNG\r\n\x1a\n"):
                    cover = content, ".png"
                elif content.startswith(b"\xff\xd8\xff"):
                    cover = content, ".jpg"
    except (OSError, ValueError, KeyError, ET.ParseError, zipfile.BadZipFile, RuntimeError, NotImplementedError):
        pass
    return fields, cover


def extract_pdf(path: Path) -> dict:
    """Read explicit PDF metadata and actual pages with the existing parser."""
    import fitz  # Already pinned in requirements.txt and used by converters.

    try:
        with fitz.open(path) as document:
            if not document.is_pdf or document.needs_pass:
                return {}
            metadata = document.metadata or {}
            fields = {}
            for name in ("title", "author"):
                value = " ".join((metadata.get(name) or "").split())
                if value:
                    fields[name] = value
            if document.page_count:
                fields["page_count"] = document.page_count
            # PDF producer/creationDate are not publisher/publication date.
            # No inferred ISBN, cover, publication year or publisher.
            return fields
    except (OSError, RuntimeError, ValueError):
        return {}
