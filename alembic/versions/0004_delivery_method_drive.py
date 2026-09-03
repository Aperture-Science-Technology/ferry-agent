"""ajoute 'drive' a l'enum delivery_method

Revision ID: 0004_delivery_method_drive
Revises: 0003_shortcode
Create Date: 2026-09-03

Livraison tier B (upload Dropbox / Google Drive, cf. services/cloud_links.py)
reutilise `Device.link_ref` deja present et la valeur `dropbox` deja
existante de `delivery_method`, mais a besoin d'une valeur `drive` en plus.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004_delivery_method_drive"
down_revision: Union[str, None] = "0003_shortcode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE ne peut pas s'executer dans le meme bloc de
    # transaction qu'un usage de la nouvelle valeur ; c'est la seule
    # instruction de cette migration donc pas de souci ici.
    op.execute("ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'drive'")


def downgrade() -> None:
    # Postgres ne permet pas de retirer une valeur d'enum sans recreer le
    # type (et migrer toutes les colonnes qui l'utilisent) : no-op, comme
    # pour les autres valeurs de cet enum (cf. downgrade de 0001).
    pass
