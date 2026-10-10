from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class InstitutionalAnnouncement(Base):
	__tablename__ = "institutional_announcements"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	title: Mapped[str] = mapped_column(String(200), nullable=False)
	message: Mapped[str] = mapped_column(Text, nullable=False)
	category: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
	priority: Mapped[str] = mapped_column(String(20), nullable=False, default="Normal")
	published_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
	)
	is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	created_by: Mapped[str | None] = mapped_column(String(320), nullable=True)
