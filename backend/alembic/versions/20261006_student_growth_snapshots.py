"""Add daily longitudinal growth snapshots."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261006_student_growth_snapshots"
down_revision: Union[str, None] = "20261005_student_applications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	op.create_table(
		"student_growth_snapshots",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("student_id", sa.Integer(), nullable=False),
		sa.Column("date", sa.Date(), nullable=False),
		sa.Column("readiness_score", sa.Float(), nullable=False),
		sa.Column("leetcode_rating", sa.Float(), nullable=True),
		sa.Column("cgpa", sa.Float(), nullable=False),
		sa.Column("project_count", sa.Integer(), nullable=False),
		sa.Column("interview_score", sa.Float(), nullable=False),
		sa.Column("profile_completeness", sa.Float(), nullable=False),
		sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("student_id", "date", name="uq_student_growth_student_date"),
	)
	op.create_index("ix_student_growth_snapshots_id", "student_growth_snapshots", ["id"], unique=False)
	op.create_index("ix_student_growth_snapshots_student_id", "student_growth_snapshots", ["student_id"], unique=False)
	op.create_index("ix_student_growth_snapshots_date", "student_growth_snapshots", ["date"], unique=False)


def downgrade() -> None:
	op.drop_index("ix_student_growth_snapshots_date", table_name="student_growth_snapshots")
	op.drop_index("ix_student_growth_snapshots_student_id", table_name="student_growth_snapshots")
	op.drop_index("ix_student_growth_snapshots_id", table_name="student_growth_snapshots")
	op.drop_table("student_growth_snapshots")
