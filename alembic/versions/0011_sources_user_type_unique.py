"""unicite (user_id, type) sur sources

Revision ID: 0011_sources_user_type_unique
Revises: 0010_gateway_job_attempts
Create Date: 2026-09-07

Phase W-12 : les Source par defaut sont matérialisees a la creation du
compte (et via ensure_default_sources pour les comptes existants). Sans
contrainte UNIQUE(user_id, type), deux requetes concurrentes creent des
doublons. On dedoublonne d'abord (au cas ou), puis on pose la contrainte.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0011_sources_user_type_unique"
down_revision: Union[str, None] = "0010_gateway_job_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reattache les library_items pointant vers un doublon vers le keeper
    # (plus ancien), puis supprime les lignes en trop.
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    FIRST_VALUE(id) OVER (
                        PARTITION BY user_id, type
                        ORDER BY created_at ASC, id ASC
                    ) AS keep_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id, type
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM sources
                WHERE user_id IS NOT NULL
            )
            UPDATE library_items AS li
            SET source_id = ranked.keep_id
            FROM ranked
            WHERE li.source_id = ranked.id
              AND ranked.rn > 1
            """
        )
    )
    op.execute(
        sa.text(
            """
            DELETE FROM sources
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY user_id, type
                            ORDER BY created_at ASC, id ASC
                        ) AS rn
                    FROM sources
                    WHERE user_id IS NOT NULL
                ) ranked
                WHERE rn > 1
            )
            """
        )
    )
    op.create_unique_constraint(
        "uq_sources_user_id_type",
        "sources",
        ["user_id", "type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_sources_user_id_type", "sources", type_="unique")
