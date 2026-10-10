"""Add persistent assessment proctoring sessions and violation history."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261010_assessment_proctoring"
down_revision: Union[str, None] = "20261009_recruiter_job_deadlines"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assessment_proctoring_sessions",
        sa.Column("session_id", sa.String(length=64), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assessment_id", sa.String(length=120), nullable=False),
        sa.Column("current_strikes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("trust_score", sa.Float(), nullable=False, server_default="100"),
        sa.Column("mobile_connected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_ping", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("auto_submit_triggered", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("current_strikes >= 0", name="ck_proctoring_session_strikes"),
        sa.CheckConstraint("trust_score >= 0 AND trust_score <= 100", name="ck_proctoring_session_trust"),
        sa.UniqueConstraint("student_id", "assessment_id", name="uq_proctoring_student_assessment"),
    )
    op.create_index(
        "ix_assessment_proctoring_sessions_student_id",
        "assessment_proctoring_sessions",
        ["student_id"],
    )
    op.create_table(
        "assessment_violations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(length=64),
            sa.ForeignKey("assessment_proctoring_sessions.session_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("strike_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("strike_count > 0", name="ck_assessment_violation_strikes"),
    )
    op.create_index("ix_assessment_violations_session_id", "assessment_violations", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_assessment_violations_session_id", table_name="assessment_violations")
    op.drop_table("assessment_violations")
    op.drop_index("ix_assessment_proctoring_sessions_student_id", table_name="assessment_proctoring_sessions")
    op.drop_table("assessment_proctoring_sessions")
