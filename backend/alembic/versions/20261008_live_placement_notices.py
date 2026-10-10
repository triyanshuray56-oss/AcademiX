"""Add live institutional announcements and drive registration deadlines."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261008_live_placement_notices"
down_revision: Union[str, None] = "20261007_repair_growth_snapshot_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	bind = op.get_bind()
	drive_columns = {column["name"] for column in sa.inspect(bind).get_columns("placement_drives")}
	drive_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("placement_drives")}
	with op.batch_alter_table("placement_drives") as batch_op:
		if "registration_deadline" not in drive_columns:
			batch_op.add_column(sa.Column("registration_deadline", sa.DateTime(timezone=True), nullable=True))
		if "ix_placement_drives_registration_deadline" not in drive_indexes:
			batch_op.create_index("ix_placement_drives_registration_deadline", ["registration_deadline"])

	op.create_table(
		"institutional_announcements",
		sa.Column("id", sa.Integer(), primary_key=True),
		sa.Column("title", sa.String(length=200), nullable=False),
		sa.Column("message", sa.Text(), nullable=False),
		sa.Column("category", sa.String(length=80), nullable=False, server_default="General"),
		sa.Column("priority", sa.String(length=20), nullable=False, server_default="Normal"),
		sa.Column("published_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
		sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
		sa.Column("created_by", sa.String(length=320), nullable=True),
	)
	op.create_index("ix_institutional_announcements_id", "institutional_announcements", ["id"])


def downgrade() -> None:
	op.drop_index("ix_institutional_announcements_id", table_name="institutional_announcements")
	op.drop_table("institutional_announcements")
	with op.batch_alter_table("placement_drives") as batch_op:
		batch_op.drop_index("ix_placement_drives_registration_deadline")
		batch_op.drop_column("registration_deadline")
