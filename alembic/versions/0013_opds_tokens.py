"""table opds_tokens pour le catalogue OPDS sortant

Revision ID: 0013_opds_tokens
Revises: 0011_sources_user_type_unique
Create Date: 2026-09-07

Phase W-28 : jetons d'acces au flux OPDS 1.2. Le secret n'est jamais
stocke en clair — seul `token_hash` (SHA-256, meme patron que les
gateways) est persiste. `revoked_at` non nul invalide le jeton ; les
requetes avec un jeton inconnu ou revoque repondent 404.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0013_opds_tokens"
down_revision: Union[str, None] = "0011_sources_user_type_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "opds_tokens",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_opds_tokens_user_id", "opds_tokens", ["user_id"])
    op.create_index("ix_opds_tokens_token_hash", "opds_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_opds_tokens_token_hash", table_name="opds_tokens")
    op.drop_index("ix_opds_tokens_user_id", table_name="opds_tokens")
    op.drop_table("opds_tokens")
