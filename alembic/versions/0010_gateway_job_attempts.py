"""compteur d'essais et backoff sur gateway_jobs

Revision ID: 0010_gateway_job_attempts
Revises: 0009_fk_ondelete
Create Date: 2026-09-07

Phase W-17 : un job ``running`` poison (fetch mort) etait repris
indefiniment et bloquait la file (``poll_job`` priorise le running).
``attempts`` + ``next_attempt_at`` permettent un backoff exponentiel et
une dead-letter apres ``gateway_job_max_attempts``.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0010_gateway_job_attempts"
down_revision: Union[str, None] = "0009_fk_ondelete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "gateway_jobs",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "gateway_jobs",
        sa.Column("next_attempt_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("gateway_jobs", "next_attempt_at")
    op.drop_column("gateway_jobs", "attempts")
