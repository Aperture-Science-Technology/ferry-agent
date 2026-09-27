"""Verifie la migration 0016 (attempts / relay_response) : chaine de revisions
et presence des colonnes ajoutees.
"""

import importlib.util
from pathlib import Path
from unittest.mock import patch

_MIGRATION_PATH = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0016_delivery_attempts.py"
_spec = importlib.util.spec_from_file_location("migration_0016_delivery_attempts", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)  # type: ignore[union-attr]


def test_revision_chain() -> None:
    assert migration.revision == "0016_delivery_attempts"
    assert migration.down_revision == "0015_delivery_target_format"


def test_upgrade_adds_attempts_and_relay_response_columns() -> None:
    added: list[tuple[str, object]] = []

    def fake_add_column(table, column):
        added.append((table, column))

    with patch.object(migration.op, "add_column", side_effect=fake_add_column):
        migration.upgrade()

    assert len(added) == 2
    assert all(table == "delivery_jobs" for table, _ in added)
    names = {col.name for _, col in added}
    assert names == {"attempts", "relay_response"}
    attempts_col = next(col for _, col in added if col.name == "attempts")
    assert attempts_col.nullable is False
    assert attempts_col.server_default is not None
    relay_col = next(col for _, col in added if col.name == "relay_response")
    assert relay_col.nullable is True


def test_downgrade_drops_columns() -> None:
    dropped: list[tuple[str, str]] = []

    def fake_drop_column(table, column):
        dropped.append((table, column))

    with patch.object(migration.op, "drop_column", side_effect=fake_drop_column):
        migration.downgrade()

    assert dropped == [
        ("delivery_jobs", "relay_response"),
        ("delivery_jobs", "attempts"),
    ]
