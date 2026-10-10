from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class RecruiterCompanyProfile(Base):
	__tablename__ = "recruiter_company_profiles"
	__table_args__ = (
		UniqueConstraint("user_id", name="uq_recruiter_company_profiles_user"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	user_id: Mapped[int] = mapped_column(
		ForeignKey("users.id", ondelete="CASCADE"),
		nullable=False,
	)
	company_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
	description: Mapped[str | None] = mapped_column(Text, nullable=True)
	website: Mapped[str | None] = mapped_column(String(500), nullable=True)
	logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
	location: Mapped[str | None] = mapped_column(String(240), nullable=True)
	industry: Mapped[str | None] = mapped_column(String(120), nullable=True)
	contact_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
	contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
	contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), nullable=False, server_default=func.now()
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False,
		server_default=func.now(),
		onupdate=func.now(),
	)
