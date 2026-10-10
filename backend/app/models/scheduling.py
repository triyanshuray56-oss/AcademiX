from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class PlacementDrive(Base):
	__tablename__ = "placement_drives"
	__table_args__ = (
		CheckConstraint(
			"status IN ('Scheduled', 'Completed', 'Conflicted')",
			name="ck_placement_drives_status",
		),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	company_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
	drive_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
	registration_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
	venue: Mapped[str] = mapped_column(String(160), nullable=False)
	status: Mapped[str] = mapped_column(String(20), nullable=False, default="Scheduled")
