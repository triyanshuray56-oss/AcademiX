"""Add resume metadata and onboarding completion state."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261001_student_onboarding"
down_revision: Union[str, None] = "20261001_deep_candidate_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		batch_op.add_column(sa.Column("resume_url", sa.String(length=500), nullable=True))
		batch_op.add_column(sa.Column("resume_filename", sa.String(length=255), nullable=True))
		batch_op.add_column(
			sa.Column(
				"documents_confirmed",
				sa.Boolean(),
				server_default=sa.false(),
				nullable=False,
			)
		)
		batch_op.add_column(
			sa.Column(
				"onboarding_complete",
				sa.Boolean(),
				server_default=sa.false(),
				nullable=False,
			)
		)


def downgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		batch_op.drop_column("onboarding_complete")
		batch_op.drop_column("documents_confirmed")
		batch_op.drop_column("resume_filename")
		batch_op.drop_column("resume_url")