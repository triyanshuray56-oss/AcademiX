"""Add recruiter-managed interviews."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261014_recruiter_interviews"
down_revision: Union[str, None] = "20261013_recruiter_portal_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	if sa.inspect(op.get_bind()).has_table("recruiter_interviews"):
		return
	op.create_table(
		"recruiter_interviews",
		sa.Column("id", sa.Integer(), primary_key=True),
		sa.Column(
			"application_id",
			sa.Integer(),
			sa.ForeignKey("student_applications.id", ondelete="CASCADE"),
			nullable=False,
		),
		sa.Column("interview_type", sa.String(length=40), nullable=False),
		sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
		sa.Column("duration_minutes", sa.Integer(), nullable=False),
		sa.Column("interviewer", sa.String(length=160), nullable=False),
		sa.Column("meeting_link", sa.String(length=1000), nullable=False, server_default=""),
		sa.Column("notes", sa.Text(), nullable=False, server_default=""),
		sa.Column("status", sa.String(length=20), nullable=False, server_default="Scheduled"),
		sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
		sa.CheckConstraint(
			"status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show')",
			name="ck_recruiter_interviews_status",
		),
		sa.CheckConstraint("duration_minutes > 0", name="ck_recruiter_interviews_duration"),
	)
	op.create_index("ix_recruiter_interviews_application_id", "recruiter_interviews", ["application_id"])
	op.create_index("ix_recruiter_interviews_scheduled_at", "recruiter_interviews", ["scheduled_at"])
	op.create_index("ix_recruiter_interviews_status", "recruiter_interviews", ["status"])
	op.create_index("ix_recruiter_interviews_id", "recruiter_interviews", ["id"])


def downgrade() -> None:
	if not sa.inspect(op.get_bind()).has_table("recruiter_interviews"):
		return
	op.drop_index("ix_recruiter_interviews_id", table_name="recruiter_interviews")
	op.drop_index("ix_recruiter_interviews_status", table_name="recruiter_interviews")
	op.drop_index("ix_recruiter_interviews_scheduled_at", table_name="recruiter_interviews")
	op.drop_index("ix_recruiter_interviews_application_id", table_name="recruiter_interviews")
	op.drop_table("recruiter_interviews")
