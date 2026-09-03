"""Validation bornee des ebooks recus d'un gateway."""

from fastapi import UploadFile


async def read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    content = bytearray()
    while chunk := await upload.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > max_bytes:
            raise ValueError(f"fichier trop volumineux (maximum {max_bytes} octets)")
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
    raise ValueError("format de fichier non reconnu")
