"""Add student connection requests and direct messages."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261012_community_messaging"
down_revision: Union[str, None] = "20261011_community_direct_connect"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "community_candidate_connections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("opportunity_title", sa.String(length=160), nullable=False),
        sa.Column("intro_message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "sender_role IN ('recruiter', 'admin')",
            name="ck_candidate_connection_sender_role",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="ck_candidate_connection_status",
        ),
    )
    op.create_index("ix_community_candidate_connections_id", "community_candidate_connections", ["id"])
    op.create_index("ix_community_candidate_connections_sender_id", "community_candidate_connections", ["sender_id"])
    op.create_index("ix_community_candidate_connections_recipient_id", "community_candidate_connections", ["recipient_id"])
    op.create_index("ix_community_candidate_connections_status", "community_candidate_connections", ["status"])

    op.create_table(
        "community_direct_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "connection_id",
            sa.Integer(),
            sa.ForeignKey("community_candidate_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("length(trim(content)) > 0", name="ck_direct_message_content_not_empty"),
    )
    op.create_index("ix_community_direct_messages_id", "community_direct_messages", ["id"])
    op.create_index("ix_community_direct_messages_connection_id", "community_direct_messages", ["connection_id"])
    op.create_index("ix_community_direct_messages_sender_id", "community_direct_messages", ["sender_id"])
    op.create_index("ix_community_direct_messages_recipient_id", "community_direct_messages", ["recipient_id"])


def downgrade() -> None:
    op.drop_index("ix_community_direct_messages_recipient_id", table_name="community_direct_messages")
    op.drop_index("ix_community_direct_messages_sender_id", table_name="community_direct_messages")
    op.drop_index("ix_community_direct_messages_connection_id", table_name="community_direct_messages")
    op.drop_index("ix_community_direct_messages_id", table_name="community_direct_messages")
    op.drop_table("community_direct_messages")
    op.drop_index("ix_community_candidate_connections_status", table_name="community_candidate_connections")
    op.drop_index("ix_community_candidate_connections_recipient_id", table_name="community_candidate_connections")
    op.drop_index("ix_community_candidate_connections_sender_id", table_name="community_candidate_connections")
    op.drop_index("ix_community_candidate_connections_id", table_name="community_candidate_connections")
    op.drop_table("community_candidate_connections")
