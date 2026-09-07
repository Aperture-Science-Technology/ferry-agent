"""chiffre Device.link_ref au repos (Fernet)

Revision ID: 0014_encrypt_link_ref
Revises: 0011_sources_user_type_unique
Create Date: 2026-09-07

W-32 : les tokens OAuth cloud (Dropbox / Drive) etaient stockes en JSON
clair dans `devices.link_ref`. Cette migration rechiffre chaque ligne
existante avec `FERNET_KEY` (premiere cle = chiffrement). Pas de SQL pur :
le script Python lit/ecrit via le bind Alembic.

Requiert `FERNET_KEY` dans l'environnement au moment de `alembic upgrade`
(sinon RuntimeError — mieux qu'un silent leave-plaintext).
"""

from __future__ import annotations

import json
import os
from typing import Sequence, Union

import sqlalchemy as sa
from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from alembic import op

revision: str = "0014_encrypt_link_ref"
down_revision: Union[str, None] = "0011_sources_user_type_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _multi_fernet_from_env() -> MultiFernet:
    raw = os.environ.get("FERNET_KEY") or ""
    keys = [part.strip().encode("ascii") for part in raw.split(",") if part.strip()]
    if not keys:
        raise RuntimeError(
            "FERNET_KEY est requis pour la migration 0014_encrypt_link_ref "
            "(generer avec: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\")"
        )
    return MultiFernet([Fernet(key) for key in keys])


def _looks_encrypted(value: str) -> bool:
    """Heuristique Fernet : prefixe version+timestamp base64 (`gAAAAA`)."""
    return value.startswith("gAAAAA")


def upgrade() -> None:
    fernet = _multi_fernet_from_env()
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, link_ref FROM devices WHERE link_ref IS NOT NULL")).fetchall()

    for row in rows:
        link_ref = row.link_ref
        if not link_ref or _looks_encrypted(link_ref):
            continue
        try:
            json.loads(link_ref)
        except (TypeError, json.JSONDecodeError):
            # Valeur corrompue : on ne touche pas (l'API degraderea en unlinked).
            continue
        encrypted = fernet.encrypt(link_ref.encode("utf-8")).decode("ascii")
        conn.execute(
            sa.text("UPDATE devices SET link_ref = :ref WHERE id = :id"),
            {"ref": encrypted, "id": row.id},
        )


def downgrade() -> None:
    """Dechiffre vers JSON clair (necessite encore FERNET_KEY)."""
    fernet = _multi_fernet_from_env()
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, link_ref FROM devices WHERE link_ref IS NOT NULL")).fetchall()

    for row in rows:
        link_ref = row.link_ref
        if not link_ref or not _looks_encrypted(link_ref):
            continue
        try:
            plaintext = fernet.decrypt(link_ref.encode("ascii")).decode("utf-8")
            json.loads(plaintext)
        except (InvalidToken, ValueError, TypeError, json.JSONDecodeError):
            continue
        conn.execute(
            sa.text("UPDATE devices SET link_ref = :ref WHERE id = :id"),
            {"ref": plaintext, "id": row.id},
        )
