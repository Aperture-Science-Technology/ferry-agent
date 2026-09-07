"""chiffre Device.link_ref au repos (Fernet)

Revision ID: 0014_encrypt_link_ref
Revises: 0011_sources_user_type_unique
Create Date: 2026-09-07

W-32 : les tokens OAuth cloud (Dropbox / Drive) etaient stockes en JSON
clair dans `devices.link_ref`. Cette migration rechiffre chaque ligne
existante avec `FERNET_KEY` (premiere cle = chiffrement). Pas de SQL pur :
le script Python lit/ecrit via le bind Alembic.

Si `devices` a des `link_ref` non nuls, `FERNET_KEY` est requis
(sinon RuntimeError — mieux qu'un silent leave-plaintext). Base vierge :
no-op sans cle.
"""

from __future__ import annotations

import json
import os
from typing import Sequence, Union

import sqlalchemy as sa
from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from alembic import op

revision: str = "0014_encrypt_link_ref"
down_revision: Union[str, None] = "0013_opds_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FERNET_REQUIRED_MSG = (
    "FERNET_KEY est requis pour la migration 0014_encrypt_link_ref "
    "(generer avec: python -c \"from cryptography.fernet import Fernet; "
    "print(Fernet.generate_key().decode())\")"
)


def _multi_fernet_from_env() -> MultiFernet | None:
    raw = os.environ.get("FERNET_KEY") or ""
    keys = [part.strip().encode("ascii") for part in raw.split(",") if part.strip()]
    if not keys:
        return None
    return MultiFernet([Fernet(key) for key in keys])


def _require_fernet_or_noop(conn: sa.Connection) -> MultiFernet | None:
    """Retourne MultiFernet, ou None si aucune ligne a (re)chiffrer et pas de cle."""
    fernet = _multi_fernet_from_env()
    if fernet is not None:
        return fernet
    count = conn.execute(
        sa.text("SELECT count(*) FROM devices WHERE link_ref IS NOT NULL")
    ).scalar()
    if not count:
        return None
    raise RuntimeError(_FERNET_REQUIRED_MSG)


def _looks_encrypted(value: str) -> bool:
    """Heuristique Fernet : prefixe version+timestamp base64 (`gAAAAA`)."""
    return value.startswith("gAAAAA")


def upgrade() -> None:
    conn = op.get_bind()
    fernet = _require_fernet_or_noop(conn)
    if fernet is None:
        return

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
    """Dechiffre vers JSON clair (FERNET_KEY requis s'il y a des lignes)."""
    conn = op.get_bind()
    fernet = _require_fernet_or_noop(conn)
    if fernet is None:
        return

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
