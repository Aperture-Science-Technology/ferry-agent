"""Verifie la migration 0014 (chiffrement link_ref) : chaine de revisions
et comportement d'upgrade sans base reelle (mock du bind).
"""

import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from cryptography.fernet import Fernet

_MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0014_encrypt_link_ref.py"
)
_spec = importlib.util.spec_from_file_location("migration_0014_encrypt_link_ref", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)  # type: ignore[union-attr]


def test_revision_chain() -> None:
    assert migration.revision == "0014_encrypt_link_ref"
    assert migration.down_revision == "0013_opds_tokens"


def test_upgrade_requires_fernet_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FERNET_KEY", raising=False)

    # Base vierge (0 link_ref) : no-op, pas d'erreur
    mock_conn_empty = MagicMock()
    mock_conn_empty.execute.return_value.scalar.return_value = 0
    with patch.object(migration.op, "get_bind", return_value=mock_conn_empty):
        migration.upgrade()

    # Des lignes a rechiffrer : FERNET_KEY requis
    mock_conn_rows = MagicMock()
    mock_conn_rows.execute.return_value.scalar.return_value = 1
    with patch.object(migration.op, "get_bind", return_value=mock_conn_rows):
        with pytest.raises(RuntimeError, match="FERNET_KEY"):
            migration.upgrade()


def test_upgrade_encrypts_plaintext_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("FERNET_KEY", key)

    device_id = "11111111-1111-1111-1111-111111111111"
    plaintext = json.dumps({"provider": "dropbox", "token": "secret-tok"})
    row = SimpleNamespace(id=device_id, link_ref=plaintext)

    mock_conn = MagicMock()
    mock_conn.execute.return_value.fetchall.return_value = [row]

    with patch.object(migration.op, "get_bind", return_value=mock_conn):
        migration.upgrade()

    # Premier execute = SELECT ; second = UPDATE
    assert mock_conn.execute.call_count == 2
    _stmt, params = mock_conn.execute.call_args_list[1].args
    encrypted = params["ref"]
    assert encrypted != plaintext
    assert encrypted.startswith("gAAAAA")
    assert "secret-tok" not in encrypted
    assert Fernet(key.encode()).decrypt(encrypted.encode()).decode() == plaintext
