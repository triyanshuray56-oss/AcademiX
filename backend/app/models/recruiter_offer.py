from datetime import date, datetime

from sqlalchemy import (
	CheckConstraint,
	Date,
	DateTime,
	Float,
	ForeignKey,
	Integer,
	String,
	Text,
	UniqueConstraint,
	func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class RecruiterOffer(Base):
	__tablename__ = "recruiter_offers"
	__table_args__ = (
		UniqueConstraint("application_id", name="uq_recruiter_offers_application"),
		CheckConstraint(
			"offer_status IN ('Draft', 'Offer Sent', 'Accepted', 'Declined')",
			name="ck_recruiter_offers_status",
		),
		CheckConstraint(
			"placement_status IN ('Not Confirmed', 'Confirmed')",
			name="ck_recruiter_offers_placement_status",
		),
		CheckConstraint("package_lpa >= 0", name="ck_recruiter_offers_package"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	application_id: Mapped[int] = mapped_column(
		ForeignKey("student_applications.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
	)
	package_lpa: Mapped[float] = mapped_column(Float, nullable=False)
	offer_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
	joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	location: Mapped[str | None] = mapped_column(String(240), nullable=True)
	employment_type: Mapped[str] = mapped_column(String(20), nullable=False)
	notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
	offer_status: Mapped[str] = mapped_column(
		String(20), nullable=False, default="Draft", index=True
	)
	placement_status: Mapped[str] = mapped_column(
		String(20), nullable=False, default="Not Confirmed"
	)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), nullable=False, server_default=func.now()
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False,
		server_default=func.now(),
		onupdate=func.now(),
	)

	application: Mapped["StudentApplication"] = relationship()
