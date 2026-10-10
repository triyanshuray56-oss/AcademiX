from datetime import date as date_type

from sqlalchemy import Date, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class StudentGrowthSnapshot(Base):
	__tablename__ = "student_growth_snapshots"
	__table_args__ = (
		UniqueConstraint("student_id", "date", name="uq_student_growth_student_date"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	student_id: Mapped[int] = mapped_column(
		ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
	)
	date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
	readiness_score: Mapped[float] = mapped_column(Float, nullable=False)
	leetcode_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
	cgpa: Mapped[float] = mapped_column(Float, nullable=False)
	project_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	interview_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
	profile_completeness: Mapped[float] = mapped_column(Float, nullable=False)

	student: Mapped["Student"] = relationship(back_populates="growth_snapshots")


def profile_completeness(student: object) -> float:
	"""Return a transparent, equally weighted completion estimate across eight domains."""
	checks = (
		bool(getattr(student, "name", "") and getattr(student, "branch", "")),
		bool(getattr(student, "university_roll_number", None)),
		bool(getattr(student, "semester_cgpas", [])),
		bool(getattr(student, "verified_tech_stack", [])),
		bool(getattr(student, "internship_experiences", [])),
		bool(getattr(student, "project_showcase", [])),
		bool(getattr(student, "resume_url", None) or getattr(student, "resume_filename", None)),
		bool(getattr(student, "college_id_verified", False)),
	)
	return round(sum(checks) / len(checks) * 100, 1)


def capture_daily_snapshot(session, student: object, snapshot_date: date_type | None = None) -> StudentGrowthSnapshot:
	"""Create at most one profile snapshot per calendar date for the student."""
	day = snapshot_date or date_type.today()
	snapshot = session.scalar(
		select(StudentGrowthSnapshot).where(
			StudentGrowthSnapshot.student_id == student.id,
			StudentGrowthSnapshot.date == day,
		)
	)
	if snapshot is None:
		snapshot = StudentGrowthSnapshot(
			student_id=student.id,
			date=day,
			readiness_score=float(student.readiness_score or 0),
			leetcode_rating=student.leetcode_rating,
			cgpa=float(student.cgpa or 0),
			project_count=len(student.project_showcase or []),
			interview_score=float(student.mock_interview_score or 0),
			profile_completeness=profile_completeness(student),
		)
		session.add(snapshot)
		try:
			session.commit()
			session.refresh(snapshot)
		except IntegrityError:
			session.rollback()
			snapshot = session.scalar(
				select(StudentGrowthSnapshot).where(
					StudentGrowthSnapshot.student_id == student.id,
					StudentGrowthSnapshot.date == day,
				)
			)
			if snapshot is None:
				raise
	return snapshot
