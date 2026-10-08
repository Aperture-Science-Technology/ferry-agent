"""FA-IDENTITY-SUB-01 : identite Clerk stable, sans fusion de comptes."""

import sqlalchemy as sa

from alembic import op

revision = "0018_users_clerk_sub"
down_revision = "0017_device_email_address"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("clerk_sub", sa.Text(), nullable=True))
    op.create_index("ix_users_clerk_sub", "users", ["clerk_sub"], unique=True)
    op.execute("UPDATE users SET clerk_sub = email WHERE email LIKE 'user_%'")
    # L'email est un attribut d'affichage ; son index non unique reste en place.
    op.drop_constraint("users_email_key", "users", type_="unique")


def downgrade() -> None:
    # Aucun compte n'est modifie pour rendre le retour en arriere possible.
    # Le verrou empeche l'ajout d'un doublon entre le controle et la contrainte.
    op.execute("LOCK TABLE users IN ACCESS EXCLUSIVE MODE")
    op.execute(
        """
        DO $$ BEGIN
            IF EXISTS (SELECT email FROM users GROUP BY email HAVING count(*) > 1) THEN
                RAISE EXCEPTION 'Downgrade 0018 impossible: emails en doublon; aucune donnee modifiee';
            END IF;
        END $$
        """
    )
    op.create_unique_constraint("users_email_key", "users", ["email"])
    op.drop_index("ix_users_clerk_sub", table_name="users")
    op.drop_column("users", "clerk_sub")
