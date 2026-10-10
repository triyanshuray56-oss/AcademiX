from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import InstitutionalAnnouncement, User

router = APIRouter(prefix="/recruiter-notices", tags=["recruiter notices"])


class RecruiterNoticeCreate(BaseModel):
	model_config = ConfigDict(extra="forbid")

	title: str = Field(min_length=3, max_length=200)
	message: str = Field(min_length=3, max_length=10000)
	category: str = Field(default="General", min_length=2, max_length=80)
	priority: Literal["Low", "Normal", "High"] = "Normal"

	@field_validator("title", "message", "category", mode="before")
	@classmethod
	def trim_text(cls, value: object) -> object:
		return value.strip() if isinstance(value, str) else value


class RecruiterNoticeRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	title: str
	message: str
	category: str
	priority: str
	published_at: datetime
	is_published: bool
	audience: Literal["All Students"] = "All Students"


@router.get("", response_model=list[RecruiterNoticeRead])
def list_recruiter_notices(
	session: Annotated[Session, Depends(get_db)],
	current_user: Annotated[User, Depends(require_roles("recruiter"))],
) -> list[RecruiterNoticeRead]:
	notices = session.scalars(
		select(InstitutionalAnnouncement)
		.where(InstitutionalAnnouncement.created_by == current_user.email)
		.order_by(
			InstitutionalAnnouncement.published_at.desc(),
			InstitutionalAnnouncement.id.desc(),
		)
	)
	return [RecruiterNoticeRead.model_validate(notice) for notice in notices]


@router.post("", response_model=RecruiterNoticeRead, status_code=201)
def publish_recruiter_notice(
	payload: RecruiterNoticeCreate,
	session: Annotated[Session, Depends(get_db)],
	current_user: Annotated[User, Depends(require_roles("recruiter"))],
) -> RecruiterNoticeRead:
	notice = InstitutionalAnnouncement(
		**payload.model_dump(),
		published_at=datetime.now(timezone.utc),
		is_published=True,
		created_by=current_user.email,
	)
	session.add(notice)
	session.commit()
	session.refresh(notice)
	return RecruiterNoticeRead.model_validate(notice)
