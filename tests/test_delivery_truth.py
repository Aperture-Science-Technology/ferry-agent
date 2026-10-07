"""FA-DELIVERY-TRUTH-01: user-visible names, file metadata and API semantics."""

import base64
import io
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import pytest

from ferry_agent.models import LibraryItem, Source
from ferry_agent.schemas import DeliveryOut
from ferry_agent.services import library, mailer

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=")


def epub_bytes(*, legacy_cover=False, pages=None):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("mimetype", "application/epub+zip")
        archive.writestr(
            "META-INF/container.xml",
            """<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OPS/book.opf"/>
</rootfiles>
</container>""",
        )
        archive.writestr(
            "OPS/book.opf",
            f'''<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="isbn" prefix="dcterms: http://purl.org/dc/terms/">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>Les Deux Tours</dc:title>
<dc:creator>J. R. R. Tolkien</dc:creator>
<dc:language>fr</dc:language>
<dc:publisher>Bourgois</dc:publisher>
<dc:date>1972-01-01</dc:date>
<dc:identifier id="isbn">urn:isbn:9782266282362</dc:identifier>
{f'<meta property="dcterms:extent">{pages} pages</meta>' if pages else ""}
{'<meta name="cover" content="cover"/>' if legacy_cover else ""}
</metadata>
<manifest>
<item id="cover" href="images/cover.png" media-type="image/png" properties="{" " if legacy_cover else "cover-image"}"/>
<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
</manifest>
<spine>
<itemref idref="chapter"/>
</spine>
</package>''',
        )
        archive.writestr("OPS/images/cover.png", PNG)
        archive.writestr(
            "OPS/chapter.xhtml",
            """<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Chapitre</title>
</head>
<body>
<p>Texte.</p>
</body>
</html>""",
        )
    return stream.getvalue()


@pytest.mark.parametrize(
    ("author", "title", "fmt", "expected"),
    [
        ("Tolkien", "Les Deux Tours", "epub", "Tolkien - Les Deux Tours.epub"),
        ("", "Les Deux Tours", "PDF", "Les Deux Tours.pdf"),
        ("Tolkien", "", "epub", "Document.epub"),
        (" A/\\B\x00 ", " Étrange\n  titre\t ", "epub", "AB - Étrange titre.epub"),
    ],
)
def test_user_filename(author, title, fmt, expected):
    item = LibraryItem(title=title, author=author, storage_path="/secret/uuid_internal.epub")
    assert library.user_facing_filename(item, fmt) == expected
    assert library.user_facing_filename(item, fmt) == library.user_facing_filename(item, fmt)


def test_filename_bounded():
    name = library.user_facing_filename(LibraryItem(title="é" * 200, author="A"), "epub")
    assert len(name) <= 120
    assert name.endswith(".epub")


@pytest.mark.parametrize("method", ["email", "dropbox", "drive", "browser_code", "usb"])
@pytest.mark.parametrize("status", ["queued", "sent", "delivered", "failed"])
def test_delivery_terminal_contract(method, status):
    out = DeliveryOut(
        id=uuid.uuid4(),
        device_id=uuid.uuid4(),
        status=status,
        method=method,
        created_at=datetime.now(UTC),
        delivered_at=None,
        error=None,
    )
    assert out.model_dump()["terminal"] is (
        status in ("delivered", "failed") or (status == "sent" and method == "email")
    )


def test_message_title_and_stable_idempotency(tmp_path, monkeypatch):
    path = tmp_path / "uuid_internal.epub"
    path.write_bytes(b"book")
    monkeypatch.setenv("SMTP_IDEMPOTENCY_HEADER", "X-Idempotency-Key")
    mailer.get_settings.cache_clear()
    try:
        messages = [
            mailer.build_message(
                str(path), "Tolkien - Les Deux Tours.epub", "reader@kindle.com", kindle=True, title="Les Deux Tours"
            )
            for _ in range(2)
        ]
        assert messages[0]["Subject"] == "Les Deux Tours"
        assert next(messages[0].iter_attachments()).get_filename() == "Tolkien - Les Deux Tours.epub"
        assert messages[0]["X-Idempotency-Key"] == messages[1]["X-Idempotency-Key"]
        assert (
            mailer.build_message(str(path), "Document.epub", "reader@kindle.com", kindle=True, title="\n ").get(
                "Subject"
            )
            == "Votre document"
        )
    finally:
        mailer.get_settings.cache_clear()


@pytest.mark.parametrize("legacy_cover", [False, True])
def test_embedded_epub_metadata_and_cover(tmp_path, legacy_cover):
    from ferry_agent.services.covers import embedded_cover

    path = tmp_path / "internal_uuid_release.epub"
    content = epub_bytes(legacy_cover=legacy_cover)
    path.write_bytes(content)
    item = LibraryItem(
        title="Le.Seigneur.Des.Anneaux.FRENCH.[EPUB]-NOTAG", storage_path=str(path), original_format="epub"
    )
    library.enrich_from_file(item, fallback_title=True)
    assert item.title == "Les Deux Tours"
    assert item.author == "J. R. R. Tolkien"
    assert item.language == "fr"
    assert item.publisher == "Bourgois"
    assert item.published_year == 1972
    assert item.isbn == "9782266282362"
    assert item.page_count is None
    assert item.cover_url == f"/api/v1/covers/{item.id}"
    cover, media = embedded_cover(item)
    assert cover.read_bytes() == PNG
    assert media == "image/png"
    assert path.read_bytes() == content


@pytest.mark.parametrize("title", ["Titre choisi", "Le.Seigneur.Des.Anneaux.FRENCH.[EPUB]-NOTAG"])
def test_nonempty_metadata_preserved(tmp_path, title):
    path = tmp_path / "book.epub"
    path.write_bytes(epub_bytes())
    values = dict(
        title=title,
        author="Auteur choisi",
        language="en",
        publisher="Éditeur",
        published_year=2000,
        isbn="9781234567890",
        page_count=42,
        cover_url="https://covers.openlibrary.org/b/id/1-L.jpg",
    )
    item = LibraryItem(storage_path=str(path), original_format="epub", **values)
    library.enrich_from_file(item)
    assert {key: getattr(item, key) for key in values} == values
    assert not list(tmp_path.glob("*.cover.*"))


def test_release_cleanup_and_pdf_honesty(tmp_path):
    from ferry_agent.services.book_metadata import clean_release_title

    release = "Le.Seigneur.Des.Anneaux.FRENCH.[EPUB]-NOTAG"
    assert clean_release_title(release) == "Le Seigneur Des Anneaux"
    item = LibraryItem(title=release, original_format="pdf", storage_path=str(tmp_path / "missing.pdf"))
    library.enrich_from_file(item, fallback_title=True)
    assert item.title == "Le Seigneur Des Anneaux"
    assert item.author is None
    assert item.cover_url is None
    assert item.page_count is None


@pytest.mark.parametrize("content", [b"not a zip", b"PK\x03\x04broken"])
def test_broken_epub_is_nonfatal(tmp_path, content):
    path = tmp_path / "book.epub"
    path.write_bytes(content)
    item = LibraryItem(title="Livre", original_format="epub", storage_path=str(path))
    library.enrich_from_file(item)
    assert item.title == "Livre"
    assert item.cover_url is None


async def test_gateway_import_extracts_real_file(tmp_path, monkeypatch):
    from ferry_agent.config import Settings
    from tests.fakes import FakeSession

    monkeypatch.setattr(library, "get_settings", lambda: Settings(library_storage_dir=str(tmp_path)))
    db = FakeSession([None, 0, Source(id=uuid.uuid4())])
    item = await library.import_from_gateway(
        db, uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), "Release.FRENCH.[EPUB]-NOTAG.epub", epub_bytes(), "epub", {}
    )
    assert item.title == "Les Deux Tours"
    assert item.author == "J. R. R. Tolkien"
    assert item.cover_url == f"/api/v1/covers/{item.id}"
    assert uuid.UUID(Path(item.storage_path).name.split("_")[0])


async def test_cloud_receives_public_filename(tmp_path, monkeypatch):
    from ferry_agent.models import DeliveryStatus
    from ferry_agent.services import delivery
    from tests.fakes import FakeSession
    from tests.test_delivery_tier_a import make_device, make_item, make_job, make_user

    path = tmp_path / "uuid_internal.epub"
    path.write_bytes(b"book")
    received = {}

    async def upload(link, filename, content):
        received.update(filename=filename, content=content)

    monkeypatch.setattr(delivery.cloud_links, "parse_link_ref", lambda _: {"provider": "dropbox"})
    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", upload)
    job = make_job()
    await delivery._deliver_tier_b(
        FakeSession(), job, make_item(storage_path=str(path)), make_device(link_ref="test"), make_user()
    )
    assert received == {"filename": "Herbert - Dune.epub", "content": b"book"}
    assert job.status == DeliveryStatus.delivered


async def test_opds_download_filename_and_embedded_cover(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from urllib.parse import unquote

    from starlette.requests import Request

    from ferry_agent.api import covers, opds
    from tests.fakes import FakeSession

    path = tmp_path / "uuid_private.epub"
    path.write_bytes(epub_bytes())
    item = LibraryItem(id=uuid.uuid4(), user_id=uuid.uuid4(), title="", original_format="epub", storage_path=str(path))
    library.enrich_from_file(item)

    async def token(*_args):
        return SimpleNamespace(user_id=item.user_id)

    monkeypatch.setattr(opds, "_require_token", token)
    monkeypatch.setattr(opds, "_enforce_rate_limit", lambda _: None)
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})
    response = await opds.opds_download("token", item.id, request, FakeSession([item]))
    assert "J. R. R. Tolkien - Les Deux Tours.epub" in unquote(response.headers["content-disposition"])
    assert "uuid_private" not in response.headers["content-disposition"]
    feed = opds.opds_service.build_acquisition_feed(
        token="token", title="Livres", self_href="http://test/feed", items=[item], page=1, total=1
    )
    assert b'type="image/png"' in feed
    assert b'type="image/jpeg"' not in feed
    for response in [
        await covers.get_cover(item.id, SimpleNamespace(id=item.user_id), FakeSession([item])),
        await opds.opds_cover("token", item.id, request, FakeSession([item])),
    ]:
        assert response.media_type == "image/png"
        assert Path(response.path).read_bytes().startswith(b"\x89PNG")


def test_explicit_page_extent(tmp_path):
    path = tmp_path / "book.epub"
    path.write_bytes(epub_bytes(pages=384))
    item = LibraryItem(title="", storage_path=str(path), original_format="epub")
    library.enrich_from_file(item)
    assert item.page_count == 384


@pytest.mark.parametrize("has_metadata", [True, False])
def test_pdf_uses_existing_parser_without_inventing_metadata(tmp_path, has_metadata):
    import fitz

    path = tmp_path / "book.pdf"
    with fitz.open() as document:
        document.new_page()
        document.new_page()
        if has_metadata:
            document.set_metadata(
                {
                    "title": "Un vrai titre",
                    "author": "Une autrice",
                    "producer": "Logiciel PDF",
                    "creationDate": "D:20261007000000",
                }
            )
        document.save(path)
    item = LibraryItem(title="Release.FRENCH.[PDF]-NOTAG", original_format="pdf", storage_path=str(path))
    library.enrich_from_file(item, fallback_title=True)
    assert item.title == ("Un vrai titre" if has_metadata else "Release")
    assert item.author == ("Une autrice" if has_metadata else None)
    assert item.page_count == 2
    assert item.publisher is None
    assert item.published_year is None
    assert item.cover_url is None
    assert item.isbn is None
    item.author = "Auteur choisi"
    item.title = "Titre choisi"
    library.enrich_from_file(item)
    assert item.author == "Auteur choisi"
    assert item.title == "Titre choisi"


def test_ordinary_language_words_are_not_release_placeholders():
    from ferry_agent.services.book_metadata import is_release_title

    assert not is_release_title("French Cooking")
    assert not is_release_title("English Literature")
    assert is_release_title("Le.Seigneur.Des.Anneaux.FRENCH.[EPUB]-NOTAG")
