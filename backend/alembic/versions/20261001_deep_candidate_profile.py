"""Add deep candidate analytics and recruiter action fields."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261001_deep_candidate_profile"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	with op.batch_alter_table("students") as batch_op:
		batch_op.add_column(
			sa.Column("semester_cgpas", sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
		)
		batch_op.add_column(
			sa.Column("active_backlogs", sa.Integer(), server_default=sa.text("0"), nullable=False)
		)
		batch_op.add_column(
			sa.Column("cleared_backlogs", sa.Integer(), server_default=sa.text("0"), nullable=False)
		)
		batch_op.add_column(sa.Column("tenth_percentage", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("twelfth_percentage", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("university_roll_number", sa.String(length=40), nullable=True))
		batch_op.add_column(sa.Column("branch_rank", sa.Integer(), nullable=True))
		batch_op.add_column(sa.Column("branch_percentile", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("leetcode_rating", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("hackerrank_rating", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("coding_score", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("github_url", sa.String(length=500), nullable=True))
		batch_op.add_column(sa.Column("portfolio_url", sa.String(length=500), nullable=True))
		batch_op.add_column(sa.Column("system_design_score", sa.Float(), nullable=True))
		batch_op.add_column(
			sa.Column("verified_tech_stack", sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
		)
		batch_op.add_column(sa.Column("ai_speech_score", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("aptitude_score", sa.Float(), nullable=True))
		batch_op.add_column(sa.Column("leadership_notes", sa.Text(), nullable=True))
		batch_op.add_column(
			sa.Column("internship_experiences", sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
		)
		batch_op.add_column(sa.Column("mentor_rating", sa.Float(), nullable=True))
		batch_op.add_column(
			sa.Column("project_showcase", sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
		)
		batch_op.create_index("ix_students_university_roll_number", ["university_roll_number"])

	with op.batch_alter_table("match_records") as batch_op:
		batch_op.add_column(
			sa.Column(
				"recruiter_action_status",
				sa.String(length=24),
				server_default=sa.text("'Not Actioned'"),
				nullable=False,
			)
		)


def downgrade() -> None:
	with op.batch_alter_table("match_records") as batch_op:
		batch_op.drop_column("recruiter_action_status")

	with op.batch_alter_table("students") as batch_op:
		batch_op.drop_index("ix_students_university_roll_number")
		for column in (
			"project_showcase",
			"mentor_rating",
			"internship_experiences",
			"leadership_notes",
			"aptitude_score",
			"ai_speech_score",
			"verified_tech_stack",
			"system_design_score",
			"portfolio_url",
			"github_url",
			"coding_score",
			"hackerrank_rating",
			"leetcode_rating",
			"branch_percentile",
			"branch_rank",
			"university_roll_number",
			"twelfth_percentage",
			"tenth_percentage",
			"cleared_backlogs",
			"active_backlogs",
			"semester_cgpas",
		):
			batch_op.drop_column(column)