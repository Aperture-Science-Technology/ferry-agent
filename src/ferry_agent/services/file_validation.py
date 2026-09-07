"""Validation bornee des ebooks recus d'un gateway."""

import mimetypes
from pathlib import Path

from fastapi import UploadFile

from ferry_agent.services.errors import FileTooLargeError, UnknownFormatError

_EBOOK_CONTENT_TYPES = {
    ".epub": "application/epub+zip",
    ".pdf": "application/pdf",
    ".mobi": "application/x-mobipocket-ebook",
    ".azw3": "application/vnd.amazon.ebook",
    ".azw": "application/vnd.amazon.ebook",
}


async def read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    content = bytearray()
    while chunk := await upload.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > max_bytes:
            raise FileTooLargeError("Ce fichier est trop volumineux (maximum 200 Mo).")
    return bytes(content)


def sniff_ebook_format(content: bytes) -> str:
    """Identifie le conteneur depuis ses octets, jamais depuis son extension."""
    if content.startswith(b"%PDF"):
        return "pdf"
    if content.startswith(b"PK\x03\x04"):
        return "epub"
    if len(content) >= 68 and content[60:68] == b"BOOKMOBI":
        # MOBI et AZW3 utilisent le meme conteneur PalmDB/BOOKMOBI.
        return "mobi"
    raise UnknownFormatError(
        "Ce fichier n'est pas un livre reconnu. Formats acceptés : EPUB, PDF, MOBI, AZW3."
    )


def content_type_for_filename(filename: str) -> str:
    """Devine le Content-Type HTTP depuis l'extension (jamais depuis le contenu)."""
    ext = Path(filename).suffix.lower()
    content_type = _EBOOK_CONTENT_TYPES.get(ext)
    if content_type:
        return content_type
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"
