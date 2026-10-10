"""Align legacy SQLite growth snapshot schemas with the current model."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261007_repair_growth_snapshot_schema"
down_revision: Union[str, None] = "20261006_student_growth_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "student_growth_snapshots"


def _columns(bind) -> set[str]:
	return {column["name"] for column in sa.inspect(bind).get_columns(TABLE)}


def upgrade() -> None:
	bind = op.get_bind()
	inspector = sa.inspect(bind)
	if not inspector.has_table(TABLE):
		op.create_table(
			TABLE,
			sa.Column("id", sa.Integer(), primary_key=True),
			sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
			sa.Column("date", sa.Date(), nullable=False),
			sa.Column("readiness_score", sa.Float(), nullable=False),
			sa.Column("leetcode_rating", sa.Float(), nullable=True),
			sa.Column("cgpa", sa.Float(), nullable=False),
			sa.Column("project_count", sa.Integer(), nullable=False, server_default="0"),
			sa.Column("interview_score", sa.Float(), nullable=False, server_default="0"),
			sa.Column("profile_completeness", sa.Float(), nullable=False),
			sa.UniqueConstraint("student_id", "date", name="uq_student_growth_student_date"),
		)
		columns = _columns(bind)
	else:
		columns = _columns(bind)
		if "date" not in columns and "snapshot_date" in columns:
			if bind.dialect.name == "sqlite":
				bind.exec_driver_sql(
					f'ALTER TABLE "{TABLE}" RENAME COLUMN "snapshot_date" TO "date"'
				)
			else:
				op.alter_column(TABLE, "snapshot_date", new_column_name="date")
			columns.remove("snapshot_date")
			columns.add("date")
		if "date" not in columns:
			op.add_column(sa.Column("date", sa.Date(), nullable=True), table_name=TABLE)
			bind.execute(sa.text(f'UPDATE "{TABLE}" SET "date" = CURRENT_DATE WHERE "date" IS NULL'))
			columns.add("date")

	missing = {
		"student_id": sa.Column("student_id", sa.Integer(), nullable=True),
		"readiness_score": sa.Column("readiness_score", sa.Float(), nullable=False, server_default="0"),
		"leetcode_rating": sa.Column("leetcode_rating", sa.Float(), nullable=True),
		"cgpa": sa.Column("cgpa", sa.Float(), nullable=False, server_default="0"),
		"project_count": sa.Column("project_count", sa.Integer(), nullable=False, server_default="0"),
		"interview_score": sa.Column("interview_score", sa.Float(), nullable=False, server_default="0"),
		"profile_completeness": sa.Column("profile_completeness", sa.Float(), nullable=False, server_default="0"),
	}
	for name, column in missing.items():
		if name not in columns:
			op.add_column(column, table_name=TABLE)
			columns.add(name)

	index_names = {index["name"] for index in sa.inspect(bind).get_indexes(TABLE)}
	if "ix_student_growth_snapshots_date" not in index_names:
		op.create_index("ix_student_growth_snapshots_date", TABLE, ["date"])
	if "ix_student_growth_snapshots_student_id" not in index_names:
		op.create_index("ix_student_growth_snapshots_student_id", TABLE, ["student_id"])


def downgrade() -> None:
	# Keep compatibility repairs in place so downgrade does not discard snapshot data.
	pass
