"""ajoute conversion_profile a devices

Revision ID: 0012_device_conversion_profile
Revises: 0011_sources_user_type_unique
Create Date: 2026-09-07

W-27 : profil de conversion par liseuse (preset JSONB). Trois presets
fixes cote applicatif (reader_6in / reader_7in_plus / tablet) ; pas de
reglage fin en v1 (risque d'explosion combinatoire).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0012_device_conversion_profile"
down_revision: Union[str, None] = "0011_sources_user_type_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("conversion_profile", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("devices", "conversion_profile")
