"""ajoute email_address nullable sur devices

Revision ID: 0017_device_email_address
Revises: 0016_delivery_attempts
Create Date: 2026-09-27

FA-MAIL-SMTP-01 / L5 : adresse Send-to-Kindle par appareil. Amazon attribue
une adresse par appareil ; plusieurs Kindle sur un meme compte doivent pouvoir
recevoir sans partager `User.kindle_email`. La colonne est nullable : repli
sur le profil utilisateur tant qu'elle n'est pas renseignee.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0017_device_email_address"
down_revision: Union[str, None] = "0016_delivery_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("email_address", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "email_address")
