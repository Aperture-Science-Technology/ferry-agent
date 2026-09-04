"""ajoute enabled a sources

Revision ID: 0006_source_enabled
Revises: 0005_library_item_metadata
Create Date: 2026-09-04

Phase F2b : permet a l'utilisateur d'activer/desactiver un fournisseur
(Gutenberg, Standard Ebooks) dans ses recherches. `server_default=true`
pour que les Source existantes restent activees sans changement de
comportement.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0006_source_enabled"
down_revision: Union[str, None] = "0005_library_item_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sources",
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("sources", "enabled")
