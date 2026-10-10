import re
import os
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import PlacementDrive, RecruiterJD, Student, StudentApplication, User
from backend.app.services.jobicy_service import fetch_jobicy_jobs
from backend.app.services.job_aggregator import aggregate_opportunities

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobPosting(BaseModel):
	model_config = ConfigDict(extra="allow")
	id: str
	title: str
	company: str
	location: str = ""
	stipend_salary: str | None = None
	salary: dict | str | None = None
	job_type: str
	description: str = ""
	application_url: str
	url: str
	tags: list[str] = Field(default_factory=list)
	source: str


class AggregateJobFeed(BaseModel):
	jobs: list[JobPosting]
	source_counts: dict[str, int]
	source: str


def _demo_jobs(now: datetime) -> list[dict]:
	"""Rich development-only listings used when no recruiter JDs exist."""
	rows = [
		("TCS", "Graduate Engineer Trainee", "Python, Java, SQL, Algorithms", "Full-time", "https://www.tcs.com/careers", 3),
		("Infosys", "Systems Engineer", "Java, Python, Data Structures, Algorithms", "Full-time", "https://www.infosys.com/careers/", 7),
		("Wipro", "Project Engineer Intern", "React, JavaScript, SQL", "Internship", "https://careers.wipro.com/", 12),
		("Accenture", "Associate Software Engineer", "Java, Cloud, SQL, Git", "Full-time", "https://www.accenture.com/careers", 4),
		("Amazon", "SDE Intern", "Java, Python, Data Structures, AWS", "Internship", "https://www.amazon.jobs/", 5),
		("Google", "Software Engineer Intern", "C++, Algorithms, Linux, System Design", "Internship", "https://careers.google.com/", 6),
		("Microsoft", "Software Engineer", "C#, Azure, .NET, Data Structures", "Full-time", "https://jobs.careers.microsoft.com/", 8),
		("Deloitte", "Analyst - Technology", "Python, SQL, Data Analytics, Cloud", "Full-time", "https://www.deloitte.com/careers", 2),
		("Cognizant", "Programmer Analyst Trainee", "Java, SQL, React, Problem Solving", "Full-time", "https://careers.cognizant.com/", 3),
		("Capgemini", "Software Engineer Intern", "Python, JavaScript, APIs, Git", "Internship", "https://www.capgemini.com/careers/", 5),
		("HCLTech", "Graduate Engineer Trainee", "C++, SQL, Linux, Networking", "Full-time", "https://www.hcltech.com/careers", 9),
		("IBM", "Associate Developer", "Python, Java, Cloud, Machine Learning", "Full-time", "https://www.ibm.com/careers", 6),
	]
	return [
		{
			"id": f"demo-job-{index + 1}", "recruiter_jd_id": None, "title": title,
			"company": company,
			"description": f"Development sample opportunity from {company}. Skills: {skills}. Apply through the employer careers page.",
			"logo": None, "url": url, "tags": [part.strip() for part in skills.split(",")],
			"job_type": [job_type], "location": "BPUT Placement Cell",
			"drive_date": (now + timedelta(days=drive_days)).replace(microsecond=0).isoformat(),
			"application_deadline": (now + timedelta(days=min(index % 6 + 1, 6), hours=12)).replace(microsecond=0).isoformat() if index < 8 else None,
			"published_at": now.isoformat(),
		}
		for index, (company, title, skills, job_type, url, drive_days) in enumerate(rows)
	]


def get_active_job_feed(session: Session, request: Request) -> tuple[list[dict], str]:
	"""Build listings only from recruiter JDs and active placement-drive records."""
	jds = list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)))
	active_drives = list(session.scalars(
		select(PlacementDrive)
		.where(
			PlacementDrive.status.in_(("Scheduled", "Conflicted")),
			PlacementDrive.drive_date >= datetime.now(),
		)
		.order_by(PlacementDrive.drive_date, PlacementDrive.id)
	))
	drive_by_company: dict[str, PlacementDrive] = {}
	for drive in active_drives:
		drive_by_company.setdefault(drive.company_name.strip().casefold(), drive)
	jobs = []
	for jd in jds:
		tags = [part.strip() for part in re.split(r"[,;|]", jd.required_skills or "") if part.strip()]
		drive = drive_by_company.get(jd.company_name.strip().casefold())
		jobs.append({
			"id": f"recruiter-jd-{jd.id}",
			"recruiter_jd_id": jd.id,
			"title": jd.role_title,
			"company": jd.company_name,
			"description": jd.description or f"Minimum CGPA: {jd.min_cgpa:g}. Required skills: {', '.join(tags)}. Package: {jd.package_lpa:g} LPA.",
			"logo": None,
			"url": str(request.url_for("get_recruiter_jd", jd_id=jd.id)),
			"tags": tags,
			"package_lpa": jd.package_lpa,
			"job_type": ["Internship"] if (getattr(jd, "job_category", None) == "internship" or (not getattr(jd, "job_category", None) and re.search(r"intern", jd.role_title, re.IGNORECASE))) else ["Full-time"],
			"location": drive.venue if drive else "",
			"drive_date": drive.drive_date.isoformat() if drive else None,
			"application_deadline": jd.application_deadline.isoformat() if jd.application_deadline else None,
			"published_at": getattr(jd, "created_at", None).isoformat() if getattr(jd, "created_at", None) else None,
		})
	if not jobs and os.getenv("APP_ENV", "development").casefold() != "production":
		return _demo_jobs(datetime.now()), "CampusLink development sample data"
	return jobs, "CampusLink recruiter database"


@router.get("/internal-postings")
def get_internal_postings(
	category: str = Query(..., pattern="^(job|internship)$"),
	session: Session = Depends(get_db),
	_current_user: User = Depends(require_roles("student")),
) -> list[dict]:
	"""Return active recruiter-created postings, separately from external feeds."""
	now = datetime.now()
	query = select(RecruiterJD).where(
		(RecruiterJD.application_deadline.is_(None)) | (RecruiterJD.application_deadline >= now)
	).order_by(RecruiterJD.id.desc())
	rows = session.scalars(query)
	postings = []
	for jd in rows:
		is_internship = _is_internship(jd)
		if (category == "internship") != is_internship:
			continue
		skills = [part.strip() for part in re.split(r"[,;|]", jd.required_skills or "") if part.strip()]
		postings.append({
			"id": f"recruiter-jd-{jd.id}",
			"recruiter_jd_id": jd.id,
			"company_name": jd.company_name,
			"role_title": jd.role_title,
			"category": "internship" if is_internship else "job",
			"ctc_lpa": None if is_internship else jd.package_lpa,
			"stipend_lpa": jd.package_lpa if is_internship else None,
			"package_lpa": jd.package_lpa,
			"cgpa_cutoff": jd.min_cgpa,
			"eligible_branches": _eligible_branches(jd.eligible_branches),
			"branch_eligibility": ", ".join(_eligible_branches(jd.eligible_branches)) or "Not specified by recruiter",
			"tech_stack": skills,
			"description": jd.description or f"Minimum CGPA: {jd.min_cgpa:g}. Required skills: {', '.join(skills) or 'Not specified'}. Package: {jd.package_lpa:g} LPA.",
			"application_deadline": jd.application_deadline.isoformat() if jd.application_deadline else None,
		})
	return postings


def _eligible_branches(value: str | None) -> list[str]:
	try:
		parsed = json.loads(value or "[]")
		return [str(branch) for branch in parsed if str(branch).strip()] if isinstance(parsed, list) else []
	except (TypeError, ValueError):
		return []


def _is_internship(jd: RecruiterJD) -> bool:
	category = getattr(jd, "job_category", None)
	return category == "internship" if category else bool(re.search(r"intern", jd.role_title, re.IGNORECASE))


@router.post("/internal-postings/{posting_id}/apply")
def apply_to_internal_posting(
	posting_id: int,
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> dict:
	"""Record a student's application to a recruiter-created posting."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	jd = session.get(RecruiterJD, posting_id)
	if jd is None or (jd.application_deadline and jd.application_deadline < datetime.now()):
		raise HTTPException(status_code=404, detail="This recruiter posting is no longer available")
	job_id = f"recruiter-jd-{jd.id}"
	application = session.scalar(select(StudentApplication).where(
		StudentApplication.student_id == student.id,
		StudentApplication.external_job_id == job_id,
	))
	if application is None:
		application = StudentApplication(
			student_id=student.id,
			external_job_id=job_id,
			job_title=jd.role_title,
			company_name=jd.company_name,
			job_url=f"/student/jobs/{'recruiter-internships' if _is_internship(jd) else 'recruiter-jobs'}?posting={jd.id}",
		)
		session.add(application)
		try:
			session.commit()
		except IntegrityError:
			session.rollback()
			application = session.scalar(select(StudentApplication).where(
				StudentApplication.student_id == student.id,
				StudentApplication.external_job_id == job_id,
			))
			if application is None:
				raise HTTPException(status_code=409, detail="Could not save your application")
	else:
		session.commit()
	session.refresh(application)
	return {"id": application.id, "job_id": job_id, "status": application.status, "created_at": application.created_at.isoformat()}


@router.get("/live")
async def get_live_jobs(
	request: Request,
	tag: str | None = Query(default=None, max_length=60),
	industry: str | None = Query(default=None, max_length=100),
	count: int = Query(default=20, ge=1, le=50),
	session: Session = Depends(get_db),
) -> dict:
	"""Return live Jobicy listings alongside CampusLink recruiter postings."""
	jobs, database_source = get_active_job_feed(session, request)
	jobicy_jobs = await fetch_jobicy_jobs(tag=tag, industry=industry, count=count)
	jobs = jobicy_jobs + jobs
	source = "Jobicy + CampusLink recruiter database" if jobicy_jobs else database_source
	if tag:
		needle = tag.casefold()
		jobs = [job for job in jobs if needle in " ".join([job["title"], job["company"], job["description"], *job["tags"]]).casefold()]
	return {
		"jobs": jobs,
		"source": source,
		"live_count": sum(str(job.get("id", "")).startswith("jobicy-") for job in jobs),
		"database_count": sum(not str(job.get("id", "")).startswith("jobicy-") for job in jobs),
	}


@router.get("/aggregate", response_model=AggregateJobFeed)
async def get_aggregated_jobs(
	type_filter: str | None = Query(default=None, alias="type", pattern="^(job|internship)$"),
	keyword: str | None = Query(default=None, max_length=100),
	count: int = Query(default=30, ge=1, le=50),
) -> AggregateJobFeed:
	"""Return normalized Jobicy and configured Internshala opportunities."""
	jobs, counts = await aggregate_opportunities(count=count, keyword=keyword)
	if type_filter:
		jobs = [job for job in jobs if job.get("job_type") == type_filter]
	return AggregateJobFeed(
		jobs=jobs,
		source_counts=counts,
		source=" + ".join(name for name, amount in (("Jobicy", counts["jobicy"]), ("Internshala/regional feed", counts["internshala"])) if amount) or "No external feeds available",
	)


class ApplicationCreate(BaseModel):
	job_id: str = Field(min_length=1, max_length=100)
	title: str = Field(min_length=1, max_length=255)
	company: str = Field(min_length=1, max_length=255)
	url: str = Field(min_length=8, max_length=1000)

	@field_validator("url")
	@classmethod
	def validate_url(cls, value: str) -> str:
		if not value.startswith(("https://", "http://")):
			raise ValueError("Job URL must use HTTP or HTTPS")
		return value


class ApplicationResult(BaseModel):
	id: int
	job_id: str
	status: str
	created_at: str


@router.get("/applications/me")
def list_my_applications(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> list[str]:
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	return list(session.scalars(select(StudentApplication.external_job_id).where(StudentApplication.student_id == student.id)))


@router.post("/apply", response_model=ApplicationResult)
def apply_to_job(
	payload: ApplicationCreate,
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> ApplicationResult:
	"""Record an authenticated student's application to an external listing."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	application = session.scalar(select(StudentApplication).where(
		StudentApplication.student_id == student.id,
		StudentApplication.external_job_id == payload.job_id,
	))
	if application is None:
		application = StudentApplication(
			student_id=student.id,
			external_job_id=payload.job_id,
			job_title=payload.title,
			company_name=payload.company,
			job_url=payload.url,
		)
		session.add(application)
		try:
			session.commit()
		except IntegrityError:
			session.rollback()
			application = session.scalar(select(StudentApplication).where(
				StudentApplication.student_id == student.id,
				StudentApplication.external_job_id == payload.job_id,
			))
			if application is None:
				raise HTTPException(status_code=409, detail="Could not save your application")
	else:
		session.commit()
	session.refresh(application)
	return ApplicationResult(
		id=application.id,
		job_id=application.external_job_id,
		status=application.status,
		created_at=application.created_at.isoformat(),
	)
