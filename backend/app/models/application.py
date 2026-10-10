from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class StudentApplication(Base):
	__tablename__ = "student_applications"
	__table_args__ = (
		UniqueConstraint("student_id", "external_job_id", name="uq_student_application_job"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	student_id: Mapped[int] = mapped_column(
		ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
	)
	external_job_id: Mapped[str] = mapped_column(String(100), nullable=False)
	job_title: Mapped[str] = mapped_column(String(255), nullable=False)
	company_name: Mapped[str] = mapped_column(String(255), nullable=False)
	job_url: Mapped[str] = mapped_column(String(1000), nullable=False)
	status: Mapped[str] = mapped_column(String(32), nullable=False, default="Applied")
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), nullable=False, server_default=func.now()
	)

	student: Mapped["Student"] = relationship(back_populates="applications")
