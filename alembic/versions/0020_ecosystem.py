"""Gateway version, OPDS token limits, and open catalog source types (FA-ECOSYSTEM-01)."""

import sqlalchemy as sa

from alembic import op

revision = "0020_ecosystem"
down_revision = "0019_device_delivery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    with op.get_context().autocommit_block():
        op.get_bind().execute(
            sa.text("ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'open_library'")
        )
        op.get_bind().execute(
            sa.text(
                "ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'internet_archive'"
            )
        )

    op.add_column("gateways", sa.Column("agent_version", sa.String(), nullable=True))
    op.add_column("opds_tokens", sa.Column("max_downloads", sa.Integer(), nullable=True))
    op.add_column(
        "opds_tokens",
        sa.Column("downloads_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "opds_tokens", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("opds_tokens", "expires_at")
    op.drop_column("opds_tokens", "downloads_count")
    op.drop_column("opds_tokens", "max_downloads")
    op.drop_column("gateways", "agent_version")
    # PostgreSQL cannot remove enum values; open_library / internet_archive stay.
