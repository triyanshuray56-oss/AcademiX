from fastapi import APIRouter, Depends, HTTPException
import json
import re
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import MatchRecord, RecruiterJD
from backend.app.schemas.api import MessageResponse
from backend.app.schemas.recruiter import RecruiterJD as RecruiterJDResponse
from backend.app.schemas.recruiter import RecruiterJDCreate, RecruiterJDUpdate

router = APIRouter(prefix="/recruiters", tags=["recruiters"])


@router.get("", response_model=list[RecruiterJDResponse])
def list_recruiter_jds(session: Session = Depends(get_db)) -> list[RecruiterJD]:
	return list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)))


@router.get("/{jd_id}", response_model=RecruiterJDResponse)
def get_recruiter_jd(jd_id: int, session: Session = Depends(get_db)) -> RecruiterJD:
	jd = session.get(RecruiterJD, jd_id)
	if jd is None:
		raise HTTPException(status_code=404, detail="Recruiter job description not found")
	return jd


@router.post("", response_model=RecruiterJDResponse, status_code=201)
def create_recruiter_jd(
	payload: RecruiterJDCreate,
	session: Session = Depends(get_db),
	_user=Depends(require_roles("recruiter")),
) -> RecruiterJD:
	values = payload.model_dump()
	if "job_category" not in payload.model_fields_set and re.search(r"intern", values["role_title"], re.IGNORECASE):
		values["job_category"] = "internship"
	values["eligible_branches"] = json.dumps(values["eligible_branches"])
	jd = RecruiterJD(**values)
	session.add(jd)
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=409, detail="Unable to create recruiter job description") from error
	session.refresh(jd)
	return jd


@router.put("/{jd_id}", response_model=RecruiterJDResponse)
def update_recruiter_jd(
	jd_id: int,
	payload: RecruiterJDUpdate,
	session: Session = Depends(get_db),
	_user=Depends(require_roles("recruiter")),
) -> RecruiterJD:
	jd = session.get(RecruiterJD, jd_id)
	if jd is None:
		raise HTTPException(status_code=404, detail="Recruiter job description not found")
	for field_name, value in payload.model_dump(exclude_unset=True).items():
		if field_name == "eligible_branches" and value is not None:
			value = json.dumps(value)
		setattr(jd, field_name, value)
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=409, detail="Unable to update recruiter job description") from error
	session.refresh(jd)
	return jd


@router.delete("/{jd_id}", response_model=MessageResponse)
def delete_recruiter_jd(
	jd_id: int,
	session: Session = Depends(get_db),
	_user=Depends(require_roles("recruiter")),
) -> MessageResponse:
	jd = session.get(RecruiterJD, jd_id)
	if jd is None:
		raise HTTPException(status_code=404, detail="Recruiter job description not found")
	session.execute(delete(MatchRecord).where(MatchRecord.jd_id == jd_id))
	session.delete(jd)
	session.commit()
	return MessageResponse(detail="Recruiter job description deleted")
