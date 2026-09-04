"""ajoute name a devices

Revision ID: 0007_device_name
Revises: 0006_source_enabled
Create Date: 2026-09-04

Workstream rename/edition des appareils : nom libre choisi par
l'utilisateur, affiche en plus de la marque/modele. Le delivery_tier
reste auto-calcule (voir _compute_tier dans api/devices.py).
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0007_device_name"
down_revision: Union[str, None] = "0006_source_enabled"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("name", sa.String(), nullable=True))
    op.create_index(op.f("ix_devices_name"), "devices", ["name"])


def downgrade() -> None:
    op.drop_index(op.f("ix_devices_name"), table_name="devices")
    op.drop_column("devices", "name")
