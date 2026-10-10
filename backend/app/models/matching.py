from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class MatchRecord(Base):
	__tablename__ = "match_records"
	__table_args__ = (
		CheckConstraint(
			"status IN ('Placed', 'In-Progress', 'Pending')",
			name="ck_match_records_status",
		),
		CheckConstraint(
			"recruiter_action_status IN ('Not Actioned', 'Shortlisted', "
			"'Interview Scheduled', 'Offer Extended')",
			name="ck_match_records_recruiter_action_status",
		),
		UniqueConstraint("student_id", "jd_id", name="uq_match_records_student_jd"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	student_id: Mapped[int] = mapped_column(
		ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
	)
	jd_id: Mapped[int] = mapped_column(
		ForeignKey("recruiter_jds.id", ondelete="CASCADE"), nullable=False, index=True
	)
	fit_score: Mapped[float] = mapped_column(Float, nullable=False)
	explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
	status: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending")
	recruiter_action_status: Mapped[str] = mapped_column(
		String(24), nullable=False, default="Not Actioned", server_default=text("'Not Actioned'")
	)

	student: Mapped["Student"] = relationship(back_populates="match_records")
	jd: Mapped["RecruiterJD"] = relationship(back_populates="match_records")