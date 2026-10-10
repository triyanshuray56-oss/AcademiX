from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class AssessmentProctoringSession(Base):
    __tablename__ = "assessment_proctoring_sessions"
    __table_args__ = (
        UniqueConstraint("student_id", "assessment_id", name="uq_proctoring_student_assessment"),
        CheckConstraint("current_strikes >= 0", name="ck_proctoring_session_strikes"),
        CheckConstraint("trust_score >= 0 AND trust_score <= 100", name="ck_proctoring_session_trust"),
    )

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    assessment_id: Mapped[str] = mapped_column(String(120), nullable=False)
    current_strikes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    trust_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0, server_default=text("100"))
    mobile_connected: Mapped[bool] = mapped_column(nullable=False, default=False, server_default=text("false"))
    last_ping: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    auto_submit_triggered: Mapped[bool] = mapped_column(nullable=False, default=False, server_default=text("false"))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AssessmentViolation(Base):
    __tablename__ = "assessment_violations"
    __table_args__ = (
        CheckConstraint("strike_count > 0", name="ck_assessment_violation_strikes"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("assessment_proctoring_sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    strike_count: Mapped[int] = mapped_column(Integer, nullable=False)
