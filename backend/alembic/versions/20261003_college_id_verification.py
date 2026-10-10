"""Add College ID upload reference and institutional verification state."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_college_id_verification"
down_revision: Union[str, None] = "20261002_student_profile_picture"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		batch_op.add_column(sa.Column("college_id_card_url", sa.Text(), nullable=True))
		batch_op.add_column(
			sa.Column(
				"college_id_verified",
				sa.Boolean(),
				server_default=sa.false(),
				nullable=False,
			)
		)


def downgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		batch_op.drop_column("college_id_verified")
		batch_op.drop_column("college_id_card_url")