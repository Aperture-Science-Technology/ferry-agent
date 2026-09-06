"""Tests fondateurs d'integrite schema : migrations <-> models <-> FKs."""

from __future__ import annotations

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from ferry_agent.db import Base
from ferry_agent import models  # noqa: F401  — peuple Base.metadata

# Migrations qui font `ALTER TYPE ... ADD VALUE` : Postgres ne sait pas
# retirer une valeur d'enum. Leur `downgrade()` est un no-op *explicite*
# (commente dans le fichier de migration), pas un `except: pass`.
# `downgrade base` reussit quand meme car 0001 droppe les types ENUM.
IRREVERSIBLE_ENUM_ADD_VALUE_REVISIONS = (
    "0002_gateway_pairing",  # source_type.torrent_gateway, pairing_status.revoked
    "0004_delivery_method_drive",  # delivery_method.drive
)

# Allowlist nominative des FK autorisees a omettre ON DELETE, avec la
# raison metier. Vide aujourd'hui : aucune des FK des 8 migrations
# (0001–0008) ne declare `ondelete`. W-02 posera CASCADE/SET NULL et
# de-xfailera ce test. Format : (table, colonne_contrainte) -> raison.
ONDELETE_ALLOWLIST: dict[tuple[str, str], str] = {
    # Exemple futur : ("sources", "user_id"): "source globale, user optionnel",
}


def _include_object(object_, name, type_, reflected, compare_to) -> bool:
    if type_ == "table" and name == "alembic_version":
        return False
    return True


def test_upgrade_then_downgrade_to_base(fresh_db_url: str, alembic_run) -> None:
    """`alembic upgrade head` puis `alembic downgrade base` sans erreur.

    Les revisions dans `IRREVERSIBLE_ENUM_ADD_VALUE_REVISIONS` (dont 0004)
    sont exclues du contrat de reversibilite des valeurs ENUM : on ne tente
    pas de retirer `'drive'` / `'torrent_gateway'` / `'revoked'`, et on ne
    masque aucune exception. Le no-op est celui des `downgrade()` de 0002
    et 0004 ; 0001 droppe ensuite `delivery_method` (et les autres enums).
    """
    assert "0004_delivery_method_drive" in IRREVERSIBLE_ENUM_ADD_VALUE_REVISIONS
    alembic_run(fresh_db_url, "head", direction="upgrade")
    alembic_run(fresh_db_url, "base", direction="downgrade")


def test_models_match_migrations(migrated_db: str, to_sync_url) -> None:
    """Apres `upgrade head`, `Base.metadata` doit coincider avec la base."""
    engine = create_engine(to_sync_url(migrated_db))
    try:
        with engine.connect() as conn:
            context = MigrationContext.configure(
                conn,
                opts={"include_object": _include_object},
            )
            diff = compare_metadata(context, Base.metadata)
    finally:
        engine.dispose()
    assert diff == [], f"models.py diverge des migrations Alembic: {diff!r}"


@pytest.mark.xfail(
    strict=True,
    reason="W-02: aucune FK des migrations 0001-0008 ne declare ON DELETE",
)
def test_all_foreign_keys_declare_ondelete(migrated_db: str, to_sync_url) -> None:
    """Chaque FK doit avoir un `ondelete` explicite, hors allowlist nommee."""
    engine = create_engine(to_sync_url(migrated_db))
    try:
        inspector = inspect(engine)
        missing: list[tuple[str, str | None, str]] = []
        for table in inspector.get_table_names():
            if table == "alembic_version":
                continue
            for fk in inspector.get_foreign_keys(table):
                ondelete = (fk.get("options") or {}).get("ondelete")
                for column in fk.get("constrained_columns") or ():
                    if (table, column) in ONDELETE_ALLOWLIST:
                        continue
                    if not ondelete:
                        missing.append((table, fk.get("name"), column))
    finally:
        engine.dispose()
    assert missing == [], f"FK sans ondelete (hors allowlist): {missing}"
