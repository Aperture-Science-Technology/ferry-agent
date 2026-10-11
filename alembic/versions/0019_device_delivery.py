"""OPDS deliveries, accent-insensitive history, and Kindle test quota reservations."""

import sqlalchemy as sa

from alembic import op

revision = "0019_device_delivery"
down_revision = "0018_users_clerk_sub"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alembic commits its current transaction before changing isolation level.
    with op.get_context().autocommit_block():
        # Alembic has already applied execution_options(isolation_level="AUTOCOMMIT")
        # to op.get_bind(). Applying it again would fail on its synthetic transaction.
        op.get_bind().execute(sa.text("ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'opds'"))
    op.execute("ALTER TABLE opds_tokens ADD COLUMN IF NOT EXISTS token_encrypted TEXT")
    op.execute("ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS catalog_token_hash VARCHAR")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_test_sends JSONB NOT NULL DEFAULT '[]'::jsonb")


def downgrade() -> None:
    # Intentionally a no-op: PostgreSQL cannot remove an enum value. Preserve
    # additive storage too, so an application rollback does not destroy data.
    pass
