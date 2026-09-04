"""ajoute source_ref a library_items

Revision ID: 0008_library_item_identity
Revises: 0007_device_name
Create Date: 2026-09-04

Workstream badge "deja possede" avec identite stricte : le matching
titre+auteur produisait des faux positifs (meme titre+auteur, contenu
different). `source_ref` (ex. "gutenberg:12345", "gateway:<id>:<job_id>")
est la reference canonique de provenance d'un LibraryItem, utilisee avec
`isbn` (deja present) pour un matching exact sans fallback titre/auteur
(voir api/books.py::search_books).
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0008_library_item_identity"
down_revision: Union[str, None] = "0007_device_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("library_items", sa.Column("source_ref", sa.String(), nullable=True))
    op.create_index(op.f("ix_library_items_source_ref"), "library_items", ["source_ref"])


def downgrade() -> None:
    op.drop_index(op.f("ix_library_items_source_ref"), table_name="library_items")
    op.drop_column("library_items", "source_ref")
