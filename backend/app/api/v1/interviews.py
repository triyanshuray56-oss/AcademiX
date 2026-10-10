from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import Student, StudentApplication, User

router = APIRouter(prefix="/interviews", tags=["interviews"])


class InterviewEvent(BaseModel):
	id: str
	application_id: int
	job_id: str
	company: str
	role_title: str
	application_status: str
	round_name: str
	scheduled_at: datetime
	status: str
	platform: str
	platform_url: str | None = None
	venue: str
	estimated: bool = True


class ApplicationInterviewSchedule(BaseModel):
	application_id: int
	job_id: str
	company: str
	role_title: str
	job_url: str
	application_status: str
	applied_at: datetime
	events: list[InterviewEvent]


class StudentInterviewSchedule(BaseModel):
	applications: list[ApplicationInterviewSchedule]
	generated_at: datetime
	note: str


def _as_utc(value: datetime) -> datetime:
	return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


@router.get("/my-schedule", response_model=StudentInterviewSchedule)
def get_my_interview_schedule(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> StudentInterviewSchedule:
	"""Build an explicitly estimated interview timeline only for this student's applications."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	applications = list(session.scalars(
		select(StudentApplication)
		.where(StudentApplication.student_id == student.id)
		.order_by(StudentApplication.created_at.desc(), StudentApplication.id.desc())
	))
	now = datetime.now(timezone.utc)
	stages = (
		("Online Coding Assessment", 2, "HackerRank practice", "https://www.hackerrank.com/dashboard", "Online · assessment link is issued by the employer"),
		("Technical Round 1", 6, "Video interview", None, "Online · meeting link pending recruiter confirmation"),
		("HR Discussion", 10, "Video interview", None, "Online · meeting link pending recruiter confirmation"),
	)
	result = []
	for application in applications:
		applied_at = _as_utc(application.created_at)
		application_state = application.status.casefold()
		shortlisted = application_state in {"shortlisted", "interview scheduled", "offer extended"}
		completed = application_state == "completed"
		events = []
		for round_name, offset_days, platform, platform_url, venue in stages:
			scheduled_at = applied_at + timedelta(days=offset_days)
			status = "Completed" if completed else (
				"Shortlisted" if shortlisted and round_name == "Technical Round 1" else (
					"Upcoming" if scheduled_at >= now else "Awaiting recruiter update"
				)
			)
			events.append(InterviewEvent(
				id=f"{application.id}-{offset_days}",
				application_id=application.id,
				job_id=application.external_job_id,
				company=application.company_name,
				role_title=application.job_title,
				application_status=application.status,
				round_name=round_name,
				scheduled_at=scheduled_at,
				status=status,
				platform=platform,
				platform_url=platform_url,
				venue=venue,
			))
		result.append(ApplicationInterviewSchedule(
			application_id=application.id,
			job_id=application.external_job_id,
			company=application.company_name,
			role_title=application.job_title,
			job_url=application.job_url,
			application_status=application.status,
			applied_at=applied_at,
			events=events,
		))
	return StudentInterviewSchedule(
		applications=result,
		generated_at=now,
		note="Round dates are indicative estimates from the application date, not recruiter-confirmed appointments. Meeting links and exact assessment URLs appear only when provided by the employer.",
	)
