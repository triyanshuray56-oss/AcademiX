from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class RecruiterInterview(Base):
	__tablename__ = "recruiter_interviews"
	__table_args__ = (
		CheckConstraint(
			"status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show')",
			name="ck_recruiter_interviews_status",
		),
		CheckConstraint("duration_minutes > 0", name="ck_recruiter_interviews_duration"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	application_id: Mapped[int] = mapped_column(
		ForeignKey("student_applications.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
	)
	interview_type: Mapped[str] = mapped_column(String(40), nullable=False)
	scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
	duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
	interviewer: Mapped[str] = mapped_column(String(160), nullable=False)
	meeting_link: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
	notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
	status: Mapped[str] = mapped_column(String(20), nullable=False, default="Scheduled", index=True)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), nullable=False, server_default=func.now()
	)

	application: Mapped["StudentApplication"] = relationship()
