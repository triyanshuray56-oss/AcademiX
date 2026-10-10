"""Add isolated storage for recruiter-to-student community invites."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261011_community_direct_connect"
down_revision: Union[str, None] = "20261010_assessment_proctoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "community_direct_connect_invites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recruiter_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opportunity_title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="sent"),
    )
    op.create_index(
        "ix_community_direct_connect_invites_id",
        "community_direct_connect_invites",
        ["id"],
    )
    op.create_index(
        "ix_community_direct_connect_invites_recruiter_user_id",
        "community_direct_connect_invites",
        ["recruiter_user_id"],
    )
    op.create_index(
        "ix_community_direct_connect_invites_student_id",
        "community_direct_connect_invites",
        ["student_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_community_direct_connect_invites_student_id", table_name="community_direct_connect_invites")
    op.drop_index("ix_community_direct_connect_invites_recruiter_user_id", table_name="community_direct_connect_invites")
    op.drop_index("ix_community_direct_connect_invites_id", table_name="community_direct_connect_invites")
    op.drop_table("community_direct_connect_invites")
