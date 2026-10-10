from datetime import date, datetime, time, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import (
	InstitutionalAnnouncement,
	PlacementDrive,
	RecruiterCompanyProfile,
	RecruiterJD,
	User,
)
from backend.app.api.v1.jobs import get_active_job_feed
from backend.app.services.jobicy_service import fetch_jobicy_jobs

router = APIRouter(prefix="/notices", tags=["notices"])
DEADLINE_WINDOW = timedelta(days=7)


class JobDeadline(BaseModel):
	id: str
	drive_id: int | None = None
	company: str
	role_title: str
	deadline: datetime
	drive_date: datetime | None = None
	days_remaining: int
	hours_remaining: int
	direct_link: str
	logo: str | None = None
	location: str = ""
	urgency: str


class DeadlineFeed(BaseModel):
	deadlines: list[JobDeadline]
	as_of: datetime
	window_days: int = 7
	note: str
	is_demo_data: bool = False


class PlacementAnnouncement(BaseModel):
	id: str
	title: str
	message: str
	category: str
	priority: str = "Normal"
	published_at: datetime
	company: str | None = None
	role_title: str | None = None
	logo: str | None = None
	package: str | None = None
	direct_link: str | None = None


class InstitutionalNoticeCreate(BaseModel):
	title: str = Field(min_length=3, max_length=200)
	message: str = Field(min_length=3, max_length=10000)
	category: str = Field(default="General", min_length=2, max_length=80)
	priority: Literal["Low", "Normal", "High"] = "Normal"
	published_at: datetime | None = None


class InstitutionalNotice(BaseModel):
	id: int
	title: str
	message: str
	category: str
	priority: str
	published_at: datetime


class StudentAdminAnnouncementRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	title: str
	message: str
	category: str
	priority: str
	published_at: datetime
	publisher: str = "Placement Cell Administration"
	direct_link: str | None = None


class StudentRecruiterNoticeRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	title: str
	message: str
	category: str
	priority: str
	published_at: datetime
	company_name: str
	logo_url: str | None = None
	direct_link: str | None = None



def _parse_deadline(value: object) -> datetime | None:
	if isinstance(value, datetime):
		return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
	if isinstance(value, date):
		return datetime.combine(value, time(23, 59), tzinfo=timezone.utc)
	if not isinstance(value, str) or not value.strip():
		return None
	try:
		parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
		return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
	except ValueError:
		try:
			return datetime.combine(date.fromisoformat(value.strip()), time(23, 59), tzinfo=timezone.utc)
		except ValueError:
			try:
				parsed = parsedate_to_datetime(value.strip())
				return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
			except (TypeError, ValueError, OverflowError):
				return None


def _deadline_entry(*, identifier: str, company: str, role: str, deadline: datetime,
					link: str, now: datetime, drive_id: int | None = None,
					drive_date: datetime | None = None, logo: str | None = None,
					location: str = "") -> JobDeadline | None:
	seconds = int((deadline - now).total_seconds())
	# Strict window: at least one full/partial day remaining and no more than seven days.
	if seconds <= 0 or seconds > DEADLINE_WINDOW.total_seconds():
		return None
	hours = (seconds + 3599) // 3600
	days = (seconds + 86399) // 86400
	return JobDeadline(
		id=identifier, drive_id=drive_id, company=company, role_title=role,
		deadline=deadline, drive_date=drive_date, days_remaining=days,
		hours_remaining=hours, direct_link=link, logo=logo, location=location,
		urgency="closing_today" if hours <= 24 else "closing_soon" if days <= 3 else "closing_this_week",
	)


@router.get("/deadlines", response_model=DeadlineFeed)
async def get_job_deadlines(
	request: Request,
	session: Session = Depends(get_db),
) -> DeadlineFeed:
	"""Return only job and placement-drive registrations closing within 1–7 days."""
	now = datetime.now(timezone.utc)
	closing_soon: list[JobDeadline] = []
	drives = list(session.scalars(
		select(PlacementDrive)
		.where(PlacementDrive.status.in_(("Scheduled", "Conflicted")))
		.order_by(PlacementDrive.registration_deadline, PlacementDrive.drive_date, PlacementDrive.id)
	))
	roles_by_company: dict[str, list[RecruiterJD]] = {}
	for role in session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)):
		roles_by_company.setdefault(role.company_name.strip().casefold(), []).append(role)
	for drive in drives:
		deadline = _parse_deadline(drive.registration_deadline)
		drive_date = _parse_deadline(drive.drive_date)
		if deadline is None or drive_date is None or drive_date <= now:
			continue
		roles = roles_by_company.get(drive.company_name.strip().casefold()) or [None]
		for role in roles:
			entry = _deadline_entry(
				identifier=f"drive-{drive.id}-jd-{role.id}" if role else f"drive-{drive.id}",
				company=drive.company_name, role=role.role_title if role else "Placement drive registration",
				deadline=deadline, drive_date=drive_date,
				link=f"/student/jobs?company={quote(drive.company_name)}", now=now,
				drive_id=drive.id, location=drive.venue,
			)
			if entry:
				closing_soon.append(entry)

	# Use the same active listing source as /jobs/live and include Jobicy's current feed.
	database_jobs, _ = get_active_job_feed(session, request)
	jobicy_jobs = await fetch_jobicy_jobs(count=50)
	seen_job_ids: set[str] = set()
	for job in [*jobicy_jobs, *database_jobs]:
		job_id = str(job.get("id") or "")
		if not job_id or job_id in seen_job_ids:
			continue
		seen_job_ids.add(job_id)
		deadline = _parse_deadline(job.get("application_deadline"))
		if deadline is None:
			continue
		url = str(job.get("url") or "/student/jobs")
		entry = _deadline_entry(
			identifier=f"job-{job_id}", company=str(job.get("company") or "Company"),
			role=str(job.get("title") or "Open position"), deadline=deadline,
			link=url, now=now, logo=job.get("logo"), location=str(job.get("location") or ""),
			drive_date=_parse_deadline(job.get("drive_date")),
		)
		if entry:
			closing_soon.append(entry)

	closing_soon.sort(key=lambda item: (item.deadline, item.company.casefold(), item.role_title.casefold()))
	return DeadlineFeed(
		deadlines=closing_soon, as_of=now,
		note="Includes active recruiter and Jobicy listings with application deadlines, plus scheduled placement drives with registration deadlines. Only deadlines 1–7 days away are shown.",
		is_demo_data=False,
	)


@router.get("/announcements", response_model=list[PlacementAnnouncement])
async def get_institutional_announcements(
	request: Request,
	session: Session = Depends(get_db),
) -> list[PlacementAnnouncement]:
	"""Combine published notices with current jobs and scheduled company drives."""
	now = datetime.now(timezone.utc)
	items: list[PlacementAnnouncement] = []
	for notice in session.scalars(
		select(InstitutionalAnnouncement)
		.where(InstitutionalAnnouncement.is_published.is_(True))
		.order_by(InstitutionalAnnouncement.published_at.desc(), InstitutionalAnnouncement.id.desc())
	):
		items.append(PlacementAnnouncement(
			id=f"notice-{notice.id}", title=notice.title, message=notice.message,
			category=notice.category, priority=notice.priority, published_at=notice.published_at,
		))

	database_jobs, _ = get_active_job_feed(session, request)
	jobicy_jobs = await fetch_jobicy_jobs(count=50)
	seen_job_ids: set[str] = set()
	for job in [*jobicy_jobs, *database_jobs]:
		job_id = str(job.get("id") or "")
		if not job_id or job_id in seen_job_ids:
			continue
		seen_job_ids.add(job_id)
		company = str(job.get("company") or "Company")
		role = str(job.get("title") or "Open position")
		published_at = _parse_deadline(job.get("published_at")) or now
		salary = job.get("salary") or {}
		package_value = job.get("package_lpa")
		if package_value is not None:
			package = f"{package_value:g} LPA"
		elif salary.get("minimum") is not None or salary.get("maximum") is not None:
			low, high = salary.get("minimum"), salary.get("maximum")
			amount = str(low) if low == high or high is None else f"{low or 'Undisclosed'}–{high}"
			package = f"{amount} {salary.get('currency') or ''}".strip()
		else:
			package = None
		items.append(PlacementAnnouncement(
			id=f"job-{job_id}", title=f"{company} is hiring: {role}",
			message=str(job.get("description") or "A new placement opportunity is available. Review the role and apply through the employer listing."),
			category="Internship" if "intern" in " ".join(job.get("job_type") or []).casefold() else "Job posting",
			published_at=published_at, company=company, role_title=role, logo=job.get("logo"),
			package=package, direct_link=str(job.get("url") or "/student/jobs"),
		))

	drives = list(session.scalars(
		select(PlacementDrive)
		.where(PlacementDrive.status.in_(("Scheduled", "Conflicted")), PlacementDrive.drive_date >= now.replace(tzinfo=None))
		.order_by(PlacementDrive.drive_date, PlacementDrive.id)
	))
	roles_by_company: dict[str, list[RecruiterJD]] = {}
	for role in session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)):
		roles_by_company.setdefault(role.company_name.strip().casefold(), []).append(role)
	for drive in drives:
		roles = roles_by_company.get(drive.company_name.strip().casefold()) or [None]
		for role in roles:
			role_title = role.role_title if role else "Placement drive"
			items.append(PlacementAnnouncement(
				id=f"drive-{drive.id}-jd-{role.id}" if role else f"drive-{drive.id}",
				title=f"{drive.company_name} placement drive: {role_title}",
				message=f"Recruitment drive scheduled for {drive.drive_date.strftime('%b %d, %Y at %I:%M %p')}. Venue: {drive.venue}.",
				category="Recruitment drive", priority="Normal", published_at=now,
				company=drive.company_name, role_title=role_title,
				package=f"{role.package_lpa:g} LPA" if role else None,
				direct_link=f"/student/jobs?company={quote(drive.company_name)}",
			))
	items.sort(key=lambda item: (item.published_at, item.id), reverse=True)
	return items


@router.post("/announcements", response_model=InstitutionalNotice, status_code=201)
def publish_institutional_announcement(
	payload: InstitutionalNoticeCreate,
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("admin")),
) -> InstitutionalAnnouncement:
	"""Publish an institutional announcement from the admin portal."""
	announcement = InstitutionalAnnouncement(
		**payload.model_dump(exclude={"published_at"}),
		published_at=payload.published_at or datetime.now(timezone.utc),
		created_by=current_user.email,
		is_published=True,
	)
	session.add(announcement)
	session.commit()
	session.refresh(announcement)
	return announcement


@router.get("/admin", response_model=list[StudentAdminAnnouncementRead])
def get_student_admin_announcements(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student", "admin", "recruiter")),
	limit: int = 100,
) -> list[StudentAdminAnnouncementRead]:
	"""Return published announcements created by administrators for students."""
	recruiter_emails = select(User.email).where(User.role == "recruiter")
	announcements = list(
		session.scalars(
			select(InstitutionalAnnouncement)
			.where(
				InstitutionalAnnouncement.is_published.is_(True),
				or_(
					InstitutionalAnnouncement.created_by.is_(None),
					InstitutionalAnnouncement.created_by.not_in(recruiter_emails),
				),
			)
			.order_by(
				InstitutionalAnnouncement.published_at.desc(),
				InstitutionalAnnouncement.id.desc(),
			)
			.limit(limit)
		)
	)
	return [
		StudentAdminAnnouncementRead(
			id=a.id,
			title=a.title,
			message=a.message,
			category=a.category,
			priority=a.priority,
			published_at=a.published_at,
			publisher="Placement Cell Administration",
			direct_link=None,
		)
		for a in announcements
	]


@router.get("/recruiter", response_model=list[StudentRecruiterNoticeRead])
def get_student_recruiter_announcements(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student", "admin", "recruiter")),
	limit: int = 100,
) -> list[StudentRecruiterNoticeRead]:
	"""Return published notices created by recruiters/companies for students."""
	recruiter_emails = select(User.email).where(User.role == "recruiter")
	announcements = list(
		session.scalars(
			select(InstitutionalAnnouncement)
			.where(
				InstitutionalAnnouncement.is_published.is_(True),
				InstitutionalAnnouncement.created_by.in_(recruiter_emails),
			)
			.order_by(
				InstitutionalAnnouncement.published_at.desc(),
				InstitutionalAnnouncement.id.desc(),
			)
			.limit(limit)
		)
	)
	if not announcements:
		return []

	unique_emails = {a.created_by for a in announcements if a.created_by}
	users = list(session.scalars(select(User).where(User.email.in_(unique_emails))))
	user_by_email = {u.email: u for u in users}
	user_ids = [u.id for u in users]
	profiles = list(
		session.scalars(
			select(RecruiterCompanyProfile).where(RecruiterCompanyProfile.user_id.in_(user_ids))
		)
	)
	profile_by_user_id = {p.user_id: p for p in profiles}

	items: list[StudentRecruiterNoticeRead] = []
	for a in announcements:
		user = user_by_email.get(a.created_by) if a.created_by else None
		profile = profile_by_user_id.get(user.id) if user else None
		raw_company = (
			profile.company_name.strip()
			if profile and profile.company_name and profile.company_name.strip()
			else None
		)
		company_name = raw_company or "Recruiter / HR"
		logo_url = profile.logo_url if profile else None
		direct_link = (
			f"/student/jobs?company={quote(company_name)}" if raw_company else None
		)

		items.append(
			StudentRecruiterNoticeRead(
				id=a.id,
				title=a.title,
				message=a.message,
				category=a.category,
				priority=a.priority,
				published_at=a.published_at,
				company_name=company_name,
				logo_url=logo_url,
				direct_link=direct_link,
			)
		)

	return items
