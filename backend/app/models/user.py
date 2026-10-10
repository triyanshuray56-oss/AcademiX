from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class User(Base):
	__tablename__ = "users"
	__table_args__ = (
		CheckConstraint(
			"role IN ('student', 'recruiter', 'admin')",
			name="ck_users_role",
		),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
	hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
	role: Mapped[str] = mapped_column(String(20), nullable=False)
	is_active: Mapped[bool] = mapped_column(
		Boolean, nullable=False, default=True, server_default=text("true")
	)
	reset_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
	reset_token_expires: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True), nullable=True
	)