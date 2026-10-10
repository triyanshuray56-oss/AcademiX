from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AnyHttpUrl
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import RecruiterCompanyProfile, User
from backend.app.schemas.recruiter_company_profile import (
	RecruiterAccountRead,
	RecruiterCompanyProfileRead,
	RecruiterCompanyProfileUpdate,
)

router = APIRouter(prefix="/recruiter-profile", tags=["recruiter profile"])

_PROFILE_FIELDS = (
	"company_name",
	"description",
	"website",
	"logo_url",
	"location",
	"industry",
	"contact_name",
	"contact_email",
	"contact_phone",
)


def _profile_response(
	profile: RecruiterCompanyProfile | None,
	current_user: User,
) -> RecruiterCompanyProfileRead:
	values = {
		field: getattr(profile, field) if profile is not None else None
		for field in _PROFILE_FIELDS
	}
	return RecruiterCompanyProfileRead(
		account=RecruiterAccountRead(
			email=current_user.email,
			role="recruiter",
			is_active=current_user.is_active,
		),
		**values,
	)


def _url_value(value: AnyHttpUrl | None) -> str | None:
	return str(value) if value is not None else None


@router.get("", response_model=RecruiterCompanyProfileRead)
def get_recruiter_profile(
	session: Annotated[Session, Depends(get_db)],
	current_user: Annotated[User, Depends(require_roles("recruiter"))],
) -> RecruiterCompanyProfileRead:
	profile = session.scalar(
		select(RecruiterCompanyProfile).where(
			RecruiterCompanyProfile.user_id == current_user.id
		)
	)
	return _profile_response(profile, current_user)


@router.put("", response_model=RecruiterCompanyProfileRead)
def save_recruiter_profile(
	payload: RecruiterCompanyProfileUpdate,
	session: Annotated[Session, Depends(get_db)],
	current_user: Annotated[User, Depends(require_roles("recruiter"))],
) -> RecruiterCompanyProfileRead:
	profile = session.scalar(
		select(RecruiterCompanyProfile).where(
			RecruiterCompanyProfile.user_id == current_user.id
		)
	)
	if profile is None:
		profile = RecruiterCompanyProfile(user_id=current_user.id)
		session.add(profile)

	values = payload.model_dump()
	values["website"] = _url_value(payload.website)
	values["logo_url"] = _url_value(payload.logo_url)
	for field, value in values.items():
		setattr(profile, field, value)

	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(
			status_code=409,
			detail="Unable to save the recruiter company profile",
		) from error
	session.refresh(profile)
	return _profile_response(profile, current_user)
