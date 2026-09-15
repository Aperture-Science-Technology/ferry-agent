"""ajoute target_format a delivery_jobs

Revision ID: 0015_delivery_target_format
Revises: 0014_encrypt_link_ref
Create Date: 2026-09-13

FA-FUNC-DELIVERY-01 : memorise le format exact demande pour une livraison
(notamment tier C, ou le telechargement a lieu plus tard). Sans cette
colonne, un envoi pouvait etre marque reussi alors que le fichier servi
restait dans le format d'origine.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0015_delivery_target_format"
down_revision: Union[str, None] = "0014_encrypt_link_ref"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("delivery_jobs", sa.Column("target_format", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("delivery_jobs", "target_format")
