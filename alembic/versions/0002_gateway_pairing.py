"""gateway pairing credentials and torrent source

Revision ID: 0002_gateway_pairing
Revises: 0001_initial_schema
Create Date: 2026-09-03
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002_gateway_pairing"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'torrent_gateway'")
    op.execute("ALTER TYPE pairing_status ADD VALUE IF NOT EXISTS 'revoked'")

    op.add_column("gateways", sa.Column("pairing_token_hash", sa.String(), nullable=True))
    op.add_column("gateways", sa.Column("pairing_expires_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column(
        "gateways",
        sa.Column("pairing_used", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_gateways_api_key_hash", "gateways", ["api_key_hash"])
    op.create_index("ix_gateways_pairing_token_hash", "gateways", ["pairing_token_hash"])
    op.alter_column("gateways", "pairing_used", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_gateways_pairing_token_hash", table_name="gateways")
    op.drop_index("ix_gateways_api_key_hash", table_name="gateways")
    op.drop_column("gateways", "pairing_used")
    op.drop_column("gateways", "pairing_expires_at")
    op.drop_column("gateways", "pairing_token_hash")
    # PostgreSQL ne sait pas retirer une valeur d'ENUM sans recreer le type.
    # Les valeurs ajoutees sont donc laissees en place lors d'un downgrade.
