"""ajoute attempts et relay_response a delivery_jobs

Revision ID: 0016_delivery_attempts
Revises: 0015_delivery_target_format
Create Date: 2026-09-27

FA-MAIL-SMTP-01 / L4 : statut veridique (sent = accepte par le relais, pas
livre sur Kindle) et diagnostic des tentatives SMTP. `attempts` compte les
essais ; `relay_response` conserve la trace d'acceptation du relais.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0016_delivery_attempts"
down_revision: Union[str, None] = "0015_delivery_target_format"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "delivery_jobs",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("delivery_jobs", sa.Column("relay_response", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("delivery_jobs", "relay_response")
    op.drop_column("delivery_jobs", "attempts")
