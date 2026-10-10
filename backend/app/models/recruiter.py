from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class RecruiterJD(Base):
	__tablename__ = "recruiter_jds"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	company_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
	role_title: Mapped[str] = mapped_column(String(160), nullable=False)
	min_cgpa: Mapped[float] = mapped_column(Float, nullable=False)
	required_skills: Mapped[str] = mapped_column(Text, nullable=False)
	package_lpa: Mapped[float] = mapped_column(Float, nullable=False)
	application_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
	job_category: Mapped[str] = mapped_column(String(20), nullable=False, default="job", server_default="job")
	description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
	eligible_branches: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")

	match_records: Mapped[list["MatchRecord"]] = relationship(back_populates="jd")
