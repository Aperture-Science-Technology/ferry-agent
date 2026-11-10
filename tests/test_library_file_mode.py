"""Mode des fichiers deposes dans la bibliotheque.

Regression : `tempfile.mkstemp` cree en 0600 et `shutil.move` conserve ce mode
lors d'une copie inter-volumes. Les livres importes depuis un connecteur
arrivaient donc en 0600 dans `ferry_library` ; la sauvegarde `tar` (lancee avec
un autre uid) echouait en « Permission denied ».
"""

from __future__ import annotations

import stat
from pathlib import Path

from ferry_agent.services import library


def test_make_readable_force_le_mode_644(tmp_path):
    book = tmp_path / "livre.epub"
    book.write_bytes(b"contenu")
    book.chmod(0o600)

    library._make_readable(book)

    assert stat.S_IMODE(book.stat().st_mode) == library.LIBRARY_FILE_MODE == 0o644


def test_make_readable_ignore_les_erreurs_de_chmod(tmp_path, monkeypatch):
    book = tmp_path / "livre.epub"
    book.write_bytes(b"contenu")

    def boom(self, mode):
        raise OSError("operation not permitted")

    monkeypatch.setattr("pathlib.Path.chmod", boom)

    library._make_readable(book)  # ne doit pas lever


def test_les_trois_chemins_d_import_rendent_le_fichier_lisible():
    text = Path(library.__file__).read_text(encoding="utf-8")

    # import_from_connector (move), import_from_upload et import_from_gateway
    # (write_bytes) doivent tous appliquer le mode.
    assert text.count("_make_readable(dest)") == 3
