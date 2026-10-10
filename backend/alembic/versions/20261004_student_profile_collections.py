"""Add structured student profile collection domains."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261004_student_profile_collections"
down_revision: Union[str, None] = "20261003_college_id_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		for column in ("responsibilities", "accomplishments", "volunteering", "extracurriculars"):
			batch_op.add_column(
				sa.Column(column, sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
			)


def downgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		for column in ("extracurriculars", "volunteering", "accomplishments", "responsibilities"):
			batch_op.drop_column(column)
