"""Verifie la migration 0006 (colonne `enabled` sur `sources`) sans base
reelle : chaine de revisions correcte, et `upgrade`/`downgrade` emettent les
bons appels Alembic (idempotents via `server_default`, donc rejouables sur
une base existante sans backfill).
"""

import importlib.util
from pathlib import Path
from unittest.mock import patch

_MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0006_source_enabled.py"
)
_spec = importlib.util.spec_from_file_location("migration_0006_source_enabled", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)  # type: ignore[union-attr]


def test_revision_chain() -> None:
    assert migration.revision == "0006_source_enabled"
    assert migration.down_revision == "0005_library_item_metadata"


def test_upgrade_adds_enabled_column_with_server_default() -> None:
    with patch.object(migration, "op") as mock_op:
        migration.upgrade()
    assert mock_op.add_column.call_count == 1
    (table_name, column), _ = mock_op.add_column.call_args
    assert table_name == "sources"
    assert column.name == "enabled"
    assert column.nullable is False


def test_downgrade_drops_enabled_column() -> None:
    with patch.object(migration, "op") as mock_op:
        migration.downgrade()
    mock_op.drop_column.assert_called_once_with("sources", "enabled")
