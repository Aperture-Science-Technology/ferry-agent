"""short codes (tier C) + library item storage path

Revision ID: 0003_shortcode
Revises: 0002_gateway_pairing
Create Date: 2026-09-03

Ajoute `library_items.storage_path` : necessaire pour que les livraisons
(tier A email, tier C code court) retrouvent le fichier physique d'un
LibraryItem, ce que rien ne permettait jusqu'ici pour les imports upload/
connecteur (seul `Source.config` du connecteur gateway retenait un chemin).
Cree aussi la table `short_codes` du mini-catalogue HTTP tier C.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0003_shortcode"
down_revision: Union[str, None] = "0002_gateway_pairing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "library_items",
        sa.Column("storage_path", sa.String(), nullable=False, server_default=""),
    )
    op.alter_column("library_items", "storage_path", server_default=None)

    op.create_table(
        "short_codes",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column(
            "delivery_job_id", pg.UUID(as_uuid=True), sa.ForeignKey("delivery_jobs.id"), nullable=False
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("downloads_left", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_short_codes_code", "short_codes", ["code"])
    op.create_index("ix_short_codes_delivery_job_id", "short_codes", ["delivery_job_id"])


def downgrade() -> None:
    op.drop_index("ix_short_codes_delivery_job_id", table_name="short_codes")
    op.drop_index("ix_short_codes_code", table_name="short_codes")
    op.drop_table("short_codes")
    op.drop_column("library_items", "storage_path")
