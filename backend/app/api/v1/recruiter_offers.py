import re
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import RecruiterInterview, RecruiterJD, RecruiterOffer, StudentApplication, User
from backend.app.ai.ai_engine import AIPlacementEngine
from backend.app.schemas.recruiter import ApplicantOverview
from backend.app.schemas.recruiter_offer import (
	RecruiterOfferCreate,
	RecruiterOfferRead,
	RecruiterOfferUpdate,
)

router = APIRouter(prefix="/recruiter-portal/offers", tags=["recruiter offers"])
RECRUITER_JOB_ID = re.compile(r"recruiter-jd-(\d+)")
OFFER_TRANSITIONS = {
	"Draft": {"Offer Sent"},
	"Offer Sent": {"Accepted", "Declined"},
	"Accepted": set(),
	"Declined": {"Draft"},
}


class OfferApplicantsResponse(BaseModel):
	applicants: list[ApplicantOverview]
	ambiguous_count: int
	unmatched_count: int


def _normalized(value: str | None) -> str:
	return (value or "").strip().casefold()


def _job_pair(job: RecruiterJD) -> tuple[str, str]:
	return (_normalized(job.company_name), _normalized(job.role_title))


def _direct_job_id(application: StudentApplication) -> int | None:
	match = RECRUITER_JOB_ID.fullmatch(application.external_job_id)
	return int(match.group(1)) if match else None


def _resolve_application_job_id(
	application: StudentApplication,
	session: Session,
) -> int:
	direct_job_id = _direct_job_id(application)
	if direct_job_id is not None:
		return direct_job_id

	application_pair = (
		_normalized(application.company_name),
		_normalized(application.job_title),
	)
	matching_jobs = [
		job for job in session.scalars(select(RecruiterJD))
		if _job_pair(job) == application_pair
	]
	if len(matching_jobs) != 1:
		raise HTTPException(
			status_code=409,
			detail="The offer application cannot be linked to one unambiguous recruiter job",
		)
	return matching_jobs[0].id


@router.get("/applicants", response_model=OfferApplicantsResponse)
def list_offer_applicants(
	recruiter_jd_id: int,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> OfferApplicantsResponse:
	job = session.get(RecruiterJD, recruiter_jd_id)
	if job is None:
		raise HTTPException(status_code=404, detail="Recruiter job not found")

	job_pair = _job_pair(job)
	jobs = list(session.scalars(select(RecruiterJD)))
	jobs_by_pair = Counter(_job_pair(candidate_job) for candidate_job in jobs)
	applications = list(
		session.scalars(
			select(StudentApplication)
			.options(joinedload(StudentApplication.student))
			.order_by(StudentApplication.created_at.desc(), StudentApplication.id.desc())
		)
	)
	direct_applications = [
		application
		for application in applications
		if application.external_job_id == f"recruiter-jd-{job.id}"
	]

	ambiguous_count = 0
	unmatched_count = 0
	for application in applications:
		if _direct_job_id(application) is not None:
			continue
		application_pair = (
			_normalized(application.company_name),
			_normalized(application.job_title),
		)
		if application_pair == job_pair and jobs_by_pair[job_pair] > 1:
			ambiguous_count += 1
		elif application_pair not in jobs_by_pair:
			unmatched_count += 1

	if direct_applications:
		matched_applications = direct_applications
	elif jobs_by_pair[job_pair] > 1:
		matched_applications = []
	else:
		matched_applications = [
			application
			for application in applications
			if _direct_job_id(application) is None
			and (
				_normalized(application.company_name),
				_normalized(application.job_title),
			) == job_pair
		]

	existing_application_ids = set(
		session.scalars(select(RecruiterOffer.application_id))
	)
	scorer = AIPlacementEngine()
	applicants = [
		ApplicantOverview(
			application_id=application.id,
			student_id=application.student.id,
			student_name=application.student.name,
			student_branch=application.student.branch,
			student_cgpa=application.student.cgpa,
			job_title=application.job_title,
			status=application.status,
			fit_score=scorer.match_and_explain(
				application.student.cgpa,
				application.student.skills,
				job.min_cgpa,
				job.required_skills,
			)["fit_score"],
			created_at=application.created_at,
		)
		for application in matched_applications
		if application.id not in existing_application_ids
	]
	applicants.sort(key=lambda applicant: applicant.fit_score, reverse=True)
	return OfferApplicantsResponse(
		applicants=applicants,
		ambiguous_count=ambiguous_count,
		unmatched_count=unmatched_count,
	)


def _offer_response(offer: RecruiterOffer, session: Session) -> RecruiterOfferRead:
	application = offer.application
	student = application.student
	return RecruiterOfferRead(
		id=offer.id,
		application_id=application.id,
		student_id=student.id,
		candidate_name=student.name,
		candidate_branch=student.branch,
		candidate_cgpa=student.cgpa,
		recruiter_jd_id=_resolve_application_job_id(application, session),
		job_title=application.job_title,
		company_name=application.company_name,
		package_lpa=offer.package_lpa,
		offer_date=offer.offer_date,
		joining_date=offer.joining_date,
		location=offer.location,
		employment_type=offer.employment_type,
		notes=offer.notes,
		offer_status=offer.offer_status,
		placement_status=offer.placement_status,
		application_status=application.status,
		latest_interview_status=session.scalar(
			select(RecruiterInterview.status)
			.where(RecruiterInterview.application_id == application.id)
			.order_by(RecruiterInterview.scheduled_at.desc(), RecruiterInterview.id.desc())
			.limit(1)
		),
		created_at=offer.created_at,
		updated_at=offer.updated_at,
	)


def _load_offer(offer_id: int, session: Session) -> RecruiterOffer:
	offer = session.scalar(
		select(RecruiterOffer)
		.options(joinedload(RecruiterOffer.application).joinedload(StudentApplication.student))
		.where(RecruiterOffer.id == offer_id)
	)
	if offer is None:
		raise HTTPException(status_code=404, detail="Offer not found")
	return offer


@router.get("", response_model=list[RecruiterOfferRead])
def list_offers(
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> list[RecruiterOfferRead]:
	offers = session.scalars(
		select(RecruiterOffer)
		.options(joinedload(RecruiterOffer.application).joinedload(StudentApplication.student))
		.order_by(RecruiterOffer.updated_at.desc(), RecruiterOffer.id.desc())
	)
	return [_offer_response(offer, session) for offer in offers]


@router.post("", response_model=RecruiterOfferRead, status_code=201)
def create_offer(
	payload: RecruiterOfferCreate,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> RecruiterOfferRead:
	application = session.scalar(
		select(StudentApplication)
		.options(joinedload(StudentApplication.student))
		.where(StudentApplication.id == payload.application_id)
	)
	if application is None:
		raise HTTPException(status_code=404, detail="Candidate application not found")
	jd = session.get(RecruiterJD, payload.recruiter_jd_id)
	if jd is None:
		raise HTTPException(status_code=404, detail="Recruiter job not found")
	direct_job_id = _direct_job_id(application)
	if direct_job_id is not None:
		if direct_job_id != jd.id:
			raise HTTPException(status_code=422, detail="The application does not belong to the selected recruiter job")
	elif (
		_normalized(application.company_name),
		_normalized(application.job_title),
	) != _job_pair(jd):
		raise HTTPException(status_code=422, detail="The application does not belong to the selected recruiter job")
	else:
		matching_jobs = [
			job
			for job in session.scalars(select(RecruiterJD))
			if _job_pair(job) == _job_pair(jd)
		]
		if len(matching_jobs) != 1:
			raise HTTPException(
				status_code=422,
				detail="The legacy application matches multiple recruiter jobs",
			)
		if session.scalar(
			select(StudentApplication.id)
			.where(StudentApplication.external_job_id == f"recruiter-jd-{jd.id}")
			.limit(1)
		) is not None:
			raise HTTPException(
				status_code=422,
				detail="Direct recruiter-job applications take priority over legacy matches",
			)
	offer = RecruiterOffer(
		application_id=application.id,
		package_lpa=jd.package_lpa if payload.package_lpa is None else payload.package_lpa,
		offer_date=payload.offer_date,
		joining_date=payload.joining_date,
		location=payload.location.strip() if payload.location and payload.location.strip() else None,
		employment_type=jd.job_category,
		notes=payload.notes.strip(),
		offer_status="Draft",
		placement_status="Not Confirmed",
	)
	session.add(offer)
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=409, detail="An offer already exists for this application") from error
	offer = _load_offer(offer.id, session)
	return _offer_response(offer, session)


@router.patch("/{offer_id}", response_model=RecruiterOfferRead)
def update_offer(
	offer_id: int,
	payload: RecruiterOfferUpdate,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> RecruiterOfferRead:
	offer = _load_offer(offer_id, session)
	updates = payload.model_dump(exclude_unset=True)
	next_status = updates.get("offer_status")
	if next_status and next_status != offer.offer_status:
		if next_status not in OFFER_TRANSITIONS[offer.offer_status]:
			raise HTTPException(
				status_code=409,
				detail=f"Cannot change offer status from {offer.offer_status} to {next_status}",
			)
	if updates.get("placement_status") == "Confirmed":
		if offer.offer_status != "Accepted":
			raise HTTPException(status_code=409, detail="Only an accepted offer can be confirmed as a placement")
		if offer.placement_status == "Confirmed":
			raise HTTPException(status_code=409, detail="Placement is already confirmed")
	for field_name, value in updates.items():
		if field_name == "location" and value is not None:
			value = value.strip() or None
		elif field_name == "notes":
			value = value.strip()
		setattr(offer, field_name, value)
	session.commit()
	offer = _load_offer(offer.id, session)
	return _offer_response(offer, session)
