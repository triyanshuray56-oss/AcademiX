from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import (
	AssessmentProctoringSession,
	AssessmentViolation,
	RecruiterInterview,
	StudentApplication,
	User,
)
from backend.app.schemas.recruiter_interview import (
	RecruiterAssessmentViolation,
	RecruiterCandidateAssessment,
	RecruiterInterviewCreate,
	RecruiterInterviewRead,
	RecruiterInterviewUpdate,
)

router = APIRouter(prefix="/recruiter-portal/interviews", tags=["recruiter interviews"])


def _interview_read(interview: RecruiterInterview, session: Session) -> RecruiterInterviewRead:
	application = interview.application
	student = application.student
	pairings = list(
		session.scalars(
			select(AssessmentProctoringSession)
			.where(AssessmentProctoringSession.student_id == student.id)
			.order_by(AssessmentProctoringSession.created_at.desc())
		)
	)
	pairing_ids = [pairing.session_id for pairing in pairings]
	violations_by_session: dict[str, list[RecruiterAssessmentViolation]] = {
		pairing_id: [] for pairing_id in pairing_ids
	}
	if pairing_ids:
		for violation in session.scalars(
			select(AssessmentViolation)
			.where(AssessmentViolation.session_id.in_(pairing_ids))
			.order_by(AssessmentViolation.timestamp)
		):
			violations_by_session[violation.session_id].append(
				RecruiterAssessmentViolation(
					event_type=violation.event_type,
					timestamp=violation.timestamp,
					strike_count=violation.strike_count,
				)
			)
	assessments = [
		RecruiterCandidateAssessment(
			assessment_id=pairing.assessment_id,
			trust_score=pairing.trust_score,
			current_strikes=pairing.current_strikes,
			auto_submit_triggered=pairing.auto_submit_triggered,
			completed=pairing.closed_at is not None,
			violations=violations_by_session[pairing.session_id],
		)
		for pairing in pairings
	]
	return RecruiterInterviewRead(
		id=interview.id,
		application_id=application.id,
		student_id=student.id,
		candidate_name=student.name,
		candidate_branch=student.branch,
		candidate_cgpa=student.cgpa,
		job_title=application.job_title,
		company_name=application.company_name,
		interview_type=interview.interview_type,
		scheduled_at=interview.scheduled_at,
		duration_minutes=interview.duration_minutes,
		interviewer=interview.interviewer,
		meeting_link=interview.meeting_link,
		notes=interview.notes,
		status=interview.status,
		created_at=interview.created_at,
		assessments=assessments,
	)


def _load_interview(interview_id: int, session: Session) -> RecruiterInterview:
	interview = session.scalar(
		select(RecruiterInterview)
		.options(
			joinedload(RecruiterInterview.application).joinedload(StudentApplication.student)
		)
		.where(RecruiterInterview.id == interview_id)
	)
	if interview is None:
		raise HTTPException(status_code=404, detail="Interview not found")
	return interview


@router.get("", response_model=list[RecruiterInterviewRead])
def list_interviews(
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> list[RecruiterInterviewRead]:
	interviews = session.scalars(
		select(RecruiterInterview)
		.options(joinedload(RecruiterInterview.application).joinedload(StudentApplication.student))
		.order_by(RecruiterInterview.scheduled_at, RecruiterInterview.id)
	)
	return [_interview_read(interview, session) for interview in interviews]


@router.post("", response_model=RecruiterInterviewRead, status_code=201)
def create_interview(
	payload: RecruiterInterviewCreate,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> RecruiterInterviewRead:
	application = session.scalar(
		select(StudentApplication)
		.options(joinedload(StudentApplication.student))
		.where(StudentApplication.id == payload.application_id)
	)
	if application is None:
		raise HTTPException(status_code=404, detail="Candidate application not found")
	interview = RecruiterInterview(**payload.model_dump())
	session.add(interview)
	session.commit()
	session.refresh(interview)
	interview = _load_interview(interview.id, session)
	return _interview_read(interview, session)


@router.patch("/{interview_id}", response_model=RecruiterInterviewRead)
def update_interview(
	interview_id: int,
	payload: RecruiterInterviewUpdate,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> RecruiterInterviewRead:
	interview = _load_interview(interview_id, session)
	for field_name, value in payload.model_dump(exclude_unset=True).items():
		setattr(interview, field_name, value)
	session.commit()
	session.refresh(interview)
	interview = _load_interview(interview.id, session)
	return _interview_read(interview, session)
