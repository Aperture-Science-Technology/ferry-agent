"""Select completed ebooks and extract bounded ZIP releases."""

import logging
import shutil
import stat
from pathlib import Path, PurePosixPath, PureWindowsPath
from zipfile import BadZipFile, ZipFile

EBOOK_SUFFIXES: frozenset[str] = frozenset({".epub", ".pdf", ".mobi", ".azw3", ".azw"})
ARCHIVE_SUFFIXES: frozenset[str] = frozenset({".zip", ".rar", ".7z"})

logger = logging.getLogger("ferry-gateway-agent")


class ArchiveError(RuntimeError):
    """Archive de lot inexploitable (format non géré, dangereuse ou trop grosse)."""


def is_ebook(path: Path) -> bool:
    return path.suffix.lower() in EBOOK_SUFFIXES


def completed_local_files(torrent: dict, download_root: Path) -> list[Path]:
    """Return complete, existing files confined to download_root."""
    download_root = download_root.resolve()
    download_dir = Path(str(torrent.get("downloadDir") or download_root)).resolve()
    files = []
    for file_info in torrent.get("files") or []:
        if not isinstance(file_info, dict) or not file_info.get("name"):
            continue
        length = int(file_info.get("length") or 0)
        completed = int(file_info.get("bytesCompleted") or 0)
        if length <= 0 or completed != length:
            continue
        candidate = (download_dir / str(file_info["name"])).resolve()
        if not candidate.is_relative_to(download_root):
            logger.warning("Ignoring file outside DOWNLOAD_PATH: %s", candidate)
            continue
        if candidate.is_file():
            files.append(candidate)
    return files


def pick_largest_ebook(files: list[Path]) -> Path | None:
    """Select by size descending, then filename ascending."""
    return min(
        (path for path in files if is_ebook(path)),
        key=lambda path: (-path.stat().st_size, path.name, str(path)),
        default=None,
    )


def extract_zip_archive(archive: Path, *, destination: Path, max_bytes: int, max_entries: int) -> None:
    """Validate every entry and size limit before writing any ZIP contents."""
    destination = destination.resolve()
    try:
        with ZipFile(archive) as zipped:
            entries = zipped.infolist()
            if len(entries) > max_entries:
                raise ArchiveError(f"{archive.name}: trop de fichiers dans l’archive")
            if sum(entry.file_size for entry in entries) > max_bytes:
                raise ArchiveError(f"{archive.name}: archive décompressée trop volumineuse")
            for entry in entries:
                name = PurePosixPath(entry.filename.replace("\\", "/"))
                target = (destination / entry.filename).resolve()
                if (
                    name.is_absolute()
                    or PureWindowsPath(entry.filename).drive
                    or ".." in name.parts
                    or not target.is_relative_to(destination)
                    or stat.S_ISLNK(entry.external_attr >> 16)
                ):
                    raise ArchiveError(f"{archive.name}: chemin de fichier dangereux : {entry.filename}")
            for entry in entries:
                target = destination / entry.filename
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with zipped.open(entry) as source, target.open("wb") as output:
                        shutil.copyfileobj(source, output)
    except (BadZipFile, OSError, RuntimeError, NotImplementedError) as error:
        if isinstance(error, ArchiveError):
            raise
        raise ArchiveError(f"{archive.name}: impossible d’extraire l’archive : {error}") from error
