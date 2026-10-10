"""Add compatible recruiter portal fields to recruiter JDs."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261013_recruiter_portal_fields"
down_revision: Union[str, None] = "20261012_community_messaging"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("recruiter_jds")}
	with op.batch_alter_table("recruiter_jds") as batch_op:
		if "job_category" not in columns:
			batch_op.add_column(sa.Column("job_category", sa.String(20), nullable=False, server_default="job"))
		if "description" not in columns:
			batch_op.add_column(sa.Column("description", sa.Text(), nullable=False, server_default=""))
		if "eligible_branches" not in columns:
			batch_op.add_column(sa.Column("eligible_branches", sa.Text(), nullable=False, server_default="[]"))
	op.execute("UPDATE recruiter_jds SET job_category = 'internship' WHERE lower(role_title) LIKE '%intern%' AND job_category = 'job'")


def downgrade() -> None:
	with op.batch_alter_table("recruiter_jds") as batch_op:
		batch_op.drop_column("eligible_branches")
		batch_op.drop_column("description")
		batch_op.drop_column("job_category")
