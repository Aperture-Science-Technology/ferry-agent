"""ajoute les metadonnees livre a library_items

Revision ID: 0005_library_item_metadata
Revises: 0004_delivery_method_drive
Create Date: 2026-09-04

Phase A : enrichit `LibraryItem` (description, langue, nombre de pages,
taille, ISBN, editeur, annee de publication) pour l'edition/suppression et
l'affichage detaille cote dashboard. Toutes les colonnes sont nullables :
les items existants n'ont pas ces metadonnees.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0005_library_item_metadata"
down_revision: Union[str, None] = "0004_delivery_method_drive"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("library_items", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("library_items", sa.Column("language", sa.String(), nullable=True))
    op.add_column("library_items", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("library_items", sa.Column("size_bytes", sa.BigInteger(), nullable=True))
    op.add_column("library_items", sa.Column("isbn", sa.String(), nullable=True))
    op.add_column("library_items", sa.Column("publisher", sa.String(), nullable=True))
    op.add_column("library_items", sa.Column("published_year", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("library_items", "published_year")
    op.drop_column("library_items", "publisher")
    op.drop_column("library_items", "isbn")
    op.drop_column("library_items", "size_bytes")
    op.drop_column("library_items", "page_count")
    op.drop_column("library_items", "language")
    op.drop_column("library_items", "description")
