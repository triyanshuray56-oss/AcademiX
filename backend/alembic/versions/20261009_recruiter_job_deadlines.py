"""Add optional application deadlines to recruiter job postings."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_recruiter_job_deadlines"
down_revision: Union[str, None] = "20261008_live_placement_notices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("recruiter_jds")}
	indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("recruiter_jds")}
	with op.batch_alter_table("recruiter_jds") as batch_op:
		if "application_deadline" not in columns:
			batch_op.add_column(sa.Column("application_deadline", sa.DateTime(timezone=True), nullable=True))
		if "ix_recruiter_jds_application_deadline" not in indexes:
			batch_op.create_index("ix_recruiter_jds_application_deadline", ["application_deadline"])


def downgrade() -> None:
	with op.batch_alter_table("recruiter_jds") as batch_op:
		batch_op.drop_index("ix_recruiter_jds_application_deadline")
		batch_op.drop_column("application_deadline")
