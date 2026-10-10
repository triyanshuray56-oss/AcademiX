"""Add recruiter offer lifecycle and placement confirmation records."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261015_recruiter_offers"
down_revision: Union[str, None] = "20261014_recruiter_interviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	if sa.inspect(op.get_bind()).has_table("recruiter_offers"):
		return
	op.create_table(
		"recruiter_offers",
		sa.Column("id", sa.Integer(), primary_key=True),
		sa.Column(
			"application_id",
			sa.Integer(),
			sa.ForeignKey("student_applications.id", ondelete="CASCADE"),
			nullable=False,
		),
		sa.Column("package_lpa", sa.Float(), nullable=False),
		sa.Column("offer_date", sa.DateTime(timezone=True), nullable=False),
		sa.Column("joining_date", sa.Date(), nullable=True),
		sa.Column("location", sa.String(length=240), nullable=True),
		sa.Column("employment_type", sa.String(length=20), nullable=False),
		sa.Column("notes", sa.Text(), nullable=False, server_default=""),
		sa.Column("offer_status", sa.String(length=20), nullable=False, server_default="Draft"),
		sa.Column("placement_status", sa.String(length=20), nullable=False, server_default="Not Confirmed"),
		sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
		sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
		sa.CheckConstraint(
			"offer_status IN ('Draft', 'Offer Sent', 'Accepted', 'Declined')",
			name="ck_recruiter_offers_status",
		),
		sa.CheckConstraint(
			"placement_status IN ('Not Confirmed', 'Confirmed')",
			name="ck_recruiter_offers_placement_status",
		),
		sa.CheckConstraint("package_lpa >= 0", name="ck_recruiter_offers_package"),
		sa.UniqueConstraint("application_id", name="uq_recruiter_offers_application"),
	)
	op.create_index("ix_recruiter_offers_id", "recruiter_offers", ["id"])
	op.create_index("ix_recruiter_offers_application_id", "recruiter_offers", ["application_id"])
	op.create_index("ix_recruiter_offers_offer_status", "recruiter_offers", ["offer_status"])


def downgrade() -> None:
	if not sa.inspect(op.get_bind()).has_table("recruiter_offers"):
		return
	op.drop_index("ix_recruiter_offers_offer_status", table_name="recruiter_offers")
	op.drop_index("ix_recruiter_offers_application_id", table_name="recruiter_offers")
	op.drop_index("ix_recruiter_offers_id", table_name="recruiter_offers")
	op.drop_table("recruiter_offers")
