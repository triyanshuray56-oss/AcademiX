"""Create persisted external student applications."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261005_student_applications"
down_revision: Union[str, None] = "20261004_student_profile_collections"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	op.create_table(
		"student_applications",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("student_id", sa.Integer(), nullable=False),
		sa.Column("external_job_id", sa.String(length=100), nullable=False),
		sa.Column("job_title", sa.String(length=255), nullable=False),
		sa.Column("company_name", sa.String(length=255), nullable=False),
		sa.Column("job_url", sa.String(length=1000), nullable=False),
		sa.Column("status", sa.String(length=32), server_default="Applied", nullable=False),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
		sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("student_id", "external_job_id", name="uq_student_application_job"),
	)
	op.create_index("ix_student_applications_id", "student_applications", ["id"], unique=False)
	op.create_index("ix_student_applications_student_id", "student_applications", ["student_id"], unique=False)


def downgrade() -> None:
	op.drop_index("ix_student_applications_student_id", table_name="student_applications")
	op.drop_index("ix_student_applications_id", table_name="student_applications")
	op.drop_table("student_applications")
