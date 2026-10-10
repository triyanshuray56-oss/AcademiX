"""Add recruiter company profiles scoped to authenticated users."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261016_recruiter_company_profiles"
down_revision: Union[str, None] = "20261015_recruiter_offers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	if sa.inspect(op.get_bind()).has_table("recruiter_company_profiles"):
		return
	op.create_table(
		"recruiter_company_profiles",
		sa.Column("id", sa.Integer(), primary_key=True),
		sa.Column(
			"user_id",
			sa.Integer(),
			sa.ForeignKey("users.id", ondelete="CASCADE"),
			nullable=False,
		),
		sa.Column("company_name", sa.String(length=160), nullable=True),
		sa.Column("description", sa.Text(), nullable=True),
		sa.Column("website", sa.String(length=500), nullable=True),
		sa.Column("logo_url", sa.String(length=500), nullable=True),
		sa.Column("location", sa.String(length=240), nullable=True),
		sa.Column("industry", sa.String(length=120), nullable=True),
		sa.Column("contact_name", sa.String(length=160), nullable=True),
		sa.Column("contact_email", sa.String(length=255), nullable=True),
		sa.Column("contact_phone", sa.String(length=50), nullable=True),
		sa.Column(
			"created_at",
			sa.DateTime(timezone=True),
			nullable=False,
			server_default=sa.func.now(),
		),
		sa.Column(
			"updated_at",
			sa.DateTime(timezone=True),
			nullable=False,
			server_default=sa.func.now(),
		),
		sa.UniqueConstraint("user_id", name="uq_recruiter_company_profiles_user"),
	)
	op.create_index(
		"ix_recruiter_company_profiles_id",
		"recruiter_company_profiles",
		["id"],
	)


def downgrade() -> None:
	if not sa.inspect(op.get_bind()).has_table("recruiter_company_profiles"):
		return
	op.drop_index(
		"ix_recruiter_company_profiles_id",
		table_name="recruiter_company_profiles",
	)
	op.drop_table("recruiter_company_profiles")
