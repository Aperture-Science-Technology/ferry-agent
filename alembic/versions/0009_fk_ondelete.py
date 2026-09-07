"""ferme les violations FK (ondelete + denormalisation delivery history)

Revision ID: 0009_fk_ondelete
Revises: 0008_library_item_identity
Create Date: 2026-09-07

Deux parcours utilisateurs produisaient une IntegrityError (500) des qu'il
existait des donnees liees :

- DELETE livre : DeliveryJob.library_item_id sans ondelete, alors que le
  service conserve volontairement l'historique de livraisons.
- DELETE device : short_codes.delivery_job_id sans ondelete, alors que
  delete_device purge les DeliveryJob (tier C cree des ShortCode).

Semantique des FK (a conserver cote models.py) :

| FK                              | Regle                         | Justification                                      |
|---------------------------------|-------------------------------|----------------------------------------------------|
| delivery_jobs.library_item_id   | nullable + ON DELETE SET NULL | L'historique survit au livre (item_title/author).  |
| short_codes.delivery_job_id     | ON DELETE CASCADE             | Un code court sans job n'a aucun sens (TTL 24 h).  |
| delivery_jobs.device_id         | ON DELETE CASCADE             | delete_device trivial, coherent avec sa docstring. |
| gateway_jobs.gateway_id         | ON DELETE CASCADE             | delete_gateway : purge manuelle devenue redondante.|
| library_items.source_id         | ON DELETE SET NULL            | Une source supprimee ne doit pas emporter la lib.  |
| devices/library_items/sources/  | ON DELETE CASCADE             | Suppression de compte (RGPD).                      |
| gateways .user_id               |                               |                                                    |

Les noms de contraintes sont resolus via ``sa.inspect`` (implicites depuis
0001/0003 : ``{table}_{column}_fkey``) pour rester robustes si Postgres les
a renommes.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0009_fk_ondelete"
down_revision: Union[str, None] = "0008_library_item_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, referred_table, ondelete)
_FK_SPECS: tuple[tuple[str, str, str, str], ...] = (
    ("delivery_jobs", "library_item_id", "library_items", "SET NULL"),
    ("short_codes", "delivery_job_id", "delivery_jobs", "CASCADE"),
    ("delivery_jobs", "device_id", "devices", "CASCADE"),
    ("gateway_jobs", "gateway_id", "gateways", "CASCADE"),
    ("library_items", "source_id", "sources", "SET NULL"),
    ("devices", "user_id", "users", "CASCADE"),
    ("library_items", "user_id", "users", "CASCADE"),
    ("sources", "user_id", "users", "CASCADE"),
    ("gateways", "user_id", "users", "CASCADE"),
)


def _fk_name(inspector: sa.Inspector, table: str, column: str) -> str:
    for fk in inspector.get_foreign_keys(table):
        if list(fk.get("constrained_columns") or ()) == [column]:
            name = fk.get("name")
            if name:
                return name
    raise RuntimeError(f"contrainte FK introuvable pour {table}.{column}")


def _rebind_foreign_keys(*, ondelete: bool) -> None:
    """Drop + recreate chaque FK ; ``ondelete=True`` applique les regles W-02."""
    bind = op.get_bind()
    for table, column, referred, rule in _FK_SPECS:
        inspector = sa.inspect(bind)
        inspector.clear_cache()
        name = _fk_name(inspector, table, column)
        op.drop_constraint(name, table, type_="foreignkey")
        kwargs = {"ondelete": rule} if ondelete else {}
        op.create_foreign_key(name, table, referred, [column], ["id"], **kwargs)


def upgrade() -> None:
    op.add_column("delivery_jobs", sa.Column("item_title", sa.String(), nullable=True))
    op.add_column("delivery_jobs", sa.Column("item_author", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE delivery_jobs AS dj
        SET item_title = li.title,
            item_author = li.author
        FROM library_items AS li
        WHERE li.id = dj.library_item_id
        """
    )

    _rebind_foreign_keys(ondelete=True)
    op.alter_column(
        "delivery_jobs",
        "library_item_id",
        existing_type=pg.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    """Retablit le schema pre-0009.

    Les ``delivery_jobs`` dont le livre a ete supprime (library_item_id NULL)
    sont effaces avant le retour a ``nullable=False`` : un downgrade ne peut
    pas reconstituer la FK perdue.
    """
    op.execute("DELETE FROM delivery_jobs WHERE library_item_id IS NULL")
    op.alter_column(
        "delivery_jobs",
        "library_item_id",
        existing_type=pg.UUID(as_uuid=True),
        nullable=False,
    )
    _rebind_foreign_keys(ondelete=False)
    op.drop_column("delivery_jobs", "item_author")
    op.drop_column("delivery_jobs", "item_title")
