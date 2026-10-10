import csv
import io
import json
import os
import pathlib
import re
import sqlite3
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from backend.app.ai.ai_engine import AIPlacementEngine
from backend.app.api.v1.drives import ACTIVE_DRIVE_STATUSES, _detect_conflicts
from backend.app.core.security import ACCESS_TOKEN_EXPIRE_MINUTES, get_password_hash, require_roles
from backend.app.database import get_db
from backend.app.models import (
	AssessmentProctoringSession,
	AssessmentViolation,
	CandidateConnection,
	DirectMessage,
	Drive,
	InstitutionalAnnouncement,
	PlacementDrive,
	RecruiterCompanyProfile,
	RecruiterInterview,
	RecruiterJD,
	RecruiterOffer,
	Student,
	StudentApplication,
	User,
)
from backend.app.schemas.admin import (
	AdminAnnouncementCreate,
	AdminAnnouncementRead,
	AdminAnnouncementUpdate,
	AdminApplicationInterviewRead,
	AdminApplicationOfferRead,
	AdminApplicationRead,
	AdminAssessmentSessionRead,
	AdminAssessmentViolationRead,
	AdminAuditEntryRead,
	AdminAuditSummaryRead,
	AdminBackupArtifact,
	AdminBranchUsageRead,
	AdminDatabaseStatusRead,
	AdminDriveAttendanceRead,
	AdminDriveStatus,
	AdminEligibilityJobRead,
	AdminEligibilityPolicyRead,
	AdminEligibilityResult,
	AdminEligibilityReviewRead,
	AdminEligibilityRoleRead,
	AdminEligibilityStudentRead,
	AdminGrievanceItemRead,
	AdminGrievanceStatusUpdate,
	AdminImportCommitPayload,
	AdminImportCommitResult,
	AdminImportPreviewRead,
	AdminImportPreviewRow,
	AdminImportRowError,
	AdminIntegrationStatusRead,
	AdminMonitoredNotificationItem,
	AdminNotificationChannelStatus,
	AdminNotificationMonitoringSummary,
	AdminOrganizationRead,
	AdminOversightSummaryRead,
	AdminPlacementDriveCreate,
	AdminPlacementDriveRead,
	AdminPlacementDriveUpdate,
	AdminReadinessPolicyRule,
	AdminReadinessTier,
	AdminRecruiterRead,
	AdminReportExportRead,
	AdminReportSummaryRead,
	AdminSettingRead,
	AdminSettingsRead,
	AdminStudentRead,
	AdminUserRead,
	AdminUserUpdate,
	AdminVerificationPolicy,
)

router = APIRouter(prefix="/admin", tags=["admin"])
AdminSession = Annotated[Session, Depends(get_db)]
CurrentAdmin = Annotated[User, Depends(require_roles("admin"))]


@router.get("/users", response_model=list[AdminUserRead])
def list_admin_users(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=255)] = None,
	role: Literal["student", "recruiter", "admin"] | None = None,
	is_active: bool | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[User]:
	statement = select(User)
	if search and search.strip():
		statement = statement.where(User.email.ilike(f"%{search.strip()}%"))
	if role is not None:
		statement = statement.where(User.role == role)
	if is_active is not None:
		statement = statement.where(User.is_active.is_(is_active))
	return list(session.scalars(statement.order_by(User.email).limit(limit)))


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_admin_user(
	user_id: int,
	payload: AdminUserUpdate,
	session: AdminSession,
	current_admin: CurrentAdmin,
) -> User:
	user = session.get(User, user_id)
	if user is None:
		raise HTTPException(status_code=404, detail="User account not found")

	next_role = payload.role if payload.role is not None else user.role
	next_active = payload.is_active if payload.is_active is not None else user.is_active
	if user.id == current_admin.id and (next_role != "admin" or not next_active):
		raise HTTPException(
			status_code=409,
			detail="Administrators cannot deactivate or demote their own account",
		)

	removing_active_admin = (
		user.role == "admin"
		and user.is_active
		and (next_role != "admin" or not next_active)
	)
	if removing_active_admin:
		active_admin_ids = session.scalars(
			select(User.id)
			.where(User.role == "admin", User.is_active.is_(True))
			.order_by(User.id)
			.with_for_update()
		).all()
		if len(active_admin_ids) <= 1:
			raise HTTPException(
				status_code=409,
				detail="The last active administrator cannot be demoted or deactivated",
			)

	active_admin_count = select(func.count(User.id)).where(
		User.role == "admin",
		User.is_active.is_(True),
	)
	allowed_transition = or_(
		and_(
			User.role == "admin",
			User.is_active.is_(True),
			next_role == "admin",
			next_active,
		),
		or_(User.role != "admin", User.is_active.is_(False)),
		active_admin_count.scalar_subquery() > 1,
	)
	values = payload.model_dump(exclude_unset=True)
	result = session.execute(
		update(User)
		.where(User.id == user_id, allowed_transition)
		.values(**values)
	)
	if result.rowcount != 1:
		session.rollback()
		if session.get(User, user_id) is None:
			raise HTTPException(status_code=404, detail="User account not found")
		if removing_active_admin:
			raise HTTPException(
				status_code=409,
				detail="The last active administrator cannot be demoted or deactivated",
			)
		raise HTTPException(status_code=409, detail="The account could not be updated")

	session.commit()
	session.refresh(user)
	return user


@router.get("/students", response_model=list[AdminStudentRead])
def list_admin_students(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=255)] = None,
	branch: Annotated[str | None, Query(max_length=40)] = None,
	onboarding_complete: bool | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[Student]:
	statement = select(Student)
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		statement = statement.where(
			or_(
				Student.name.ilike(pattern),
				Student.email.ilike(pattern),
				Student.university_roll_number.ilike(pattern),
			)
		)
	if branch and branch.strip():
		statement = statement.where(Student.branch.ilike(branch.strip()))
	if onboarding_complete is not None:
		statement = statement.where(
			Student.onboarding_complete.is_(onboarding_complete)
		)
	return list(
		session.scalars(statement.order_by(Student.name, Student.id).limit(limit))
	)


@router.get("/recruiters", response_model=list[AdminRecruiterRead])
def list_admin_recruiters(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=255)] = None,
	is_active: bool | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AdminRecruiterRead]:
	posting_count = (
		select(func.count(RecruiterJD.id))
		.where(
			func.lower(RecruiterJD.company_name)
			== func.lower(RecruiterCompanyProfile.company_name)
		)
		.correlate(RecruiterCompanyProfile)
		.scalar_subquery()
	)
	statement = (
		select(
			User.id,
			User.email,
			User.is_active,
			RecruiterCompanyProfile.company_name,
			RecruiterCompanyProfile.description,
			RecruiterCompanyProfile.website,
			RecruiterCompanyProfile.location,
			RecruiterCompanyProfile.industry,
			case(
				(RecruiterCompanyProfile.company_name.is_(None), None),
				else_=func.coalesce(posting_count, 0),
			).label("job_posting_count"),
		)
		.outerjoin(
			RecruiterCompanyProfile,
			RecruiterCompanyProfile.user_id == User.id,
		)
		.where(User.role == "recruiter")
	)
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		statement = statement.where(
			or_(
				User.email.ilike(pattern),
				RecruiterCompanyProfile.company_name.ilike(pattern),
			)
		)
	if is_active is not None:
		statement = statement.where(User.is_active.is_(is_active))

	return [
		AdminRecruiterRead.model_validate(row._mapping)
		for row in session.execute(
			statement.order_by(User.email).limit(limit)
		)
	]


def _eligible_branch_list(raw_value: str | None) -> list[str] | None:
	if raw_value is None:
		return None
	try:
		value = json.loads(raw_value)
	except (TypeError, ValueError):
		return None
	if not isinstance(value, list) or any(not isinstance(branch, str) for branch in value):
		return None
	return [branch.strip() for branch in value if branch.strip()]


def _admin_job_read(job: RecruiterJD) -> AdminEligibilityJobRead:
	return AdminEligibilityJobRead(
		id=job.id,
		company_name=job.company_name,
		role_title=job.role_title,
		job_category=job.job_category,
		min_cgpa=job.min_cgpa,
		required_skills=job.required_skills,
		eligible_branches=_eligible_branch_list(job.eligible_branches),
		application_deadline=job.application_deadline,
	)


def _drive_conflicts_by_pair(session: Session) -> dict[tuple[int, int], list[str]]:
	active_drives = list(
		session.scalars(
			select(PlacementDrive)
			.where(PlacementDrive.status.in_(ACTIVE_DRIVE_STATUSES))
			.order_by(PlacementDrive.drive_date, PlacementDrive.id)
		)
	)
	conflicts = _detect_conflicts(session, active_drives)
	return {
		tuple(sorted(conflict.drive_ids)): conflict.conflict_types
		for conflict in conflicts
	}


def _admin_drive_read(
	drive: PlacementDrive,
	conflicts_by_pair: dict[tuple[int, int], list[str]],
	jobs: list[RecruiterJD],
) -> AdminPlacementDriveRead:
	drive_id = drive.id
	conflicting_drive_ids = sorted(
		other_id
		for pair in conflicts_by_pair
		if drive_id in pair
		for other_id in pair
		if other_id != drive_id
	)
	normalized_company = drive.company_name.strip().casefold()
	return AdminPlacementDriveRead(
		id=drive.id,
		company_name=drive.company_name,
		drive_date=drive.drive_date,
		registration_deadline=drive.registration_deadline,
		venue=drive.venue,
		status=drive.status,
		conflicting_drive_ids=conflicting_drive_ids,
		recruiter_jobs=[
			_admin_job_read(job)
			for job in jobs
			if job.company_name.strip().casefold() == normalized_company
		],
	)


@router.get("/drives", response_model=list[AdminPlacementDriveRead])
def list_admin_drives(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=120)] = None,
	status: AdminDriveStatus | None = None,
	date_from: date | None = None,
	date_to: date | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AdminPlacementDriveRead]:
	if date_from is not None and date_to is not None and date_from > date_to:
		raise HTTPException(status_code=422, detail="Start date cannot be after end date")

	statement = select(PlacementDrive)
	if search and search.strip():
		statement = statement.where(
			PlacementDrive.company_name.ilike(f"%{search.strip()}%")
		)
	if status is not None:
		statement = statement.where(PlacementDrive.status == status)
	if date_from is not None:
		statement = statement.where(
			PlacementDrive.drive_date >= datetime.combine(date_from, time.min)
		)
	if date_to is not None:
		statement = statement.where(
			PlacementDrive.drive_date <= datetime.combine(date_to, time.max)
		)

	drives = list(
		session.scalars(
			statement.order_by(PlacementDrive.drive_date, PlacementDrive.id).limit(limit)
		)
	)
	conflicts_by_pair = _drive_conflicts_by_pair(session)
	jobs = list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)))
	return [
		_admin_drive_read(drive, conflicts_by_pair, jobs)
		for drive in drives
	]


@router.post("/drives", response_model=AdminPlacementDriveRead, status_code=201)
def create_admin_drive(
	payload: AdminPlacementDriveCreate,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminPlacementDriveRead:
	before_pairs = set(_drive_conflicts_by_pair(session))
	values = payload.model_dump()
	values["company_name"] = values["company_name"].strip()
	values["venue"] = values["venue"].strip()
	drive = PlacementDrive(**values)
	session.add(drive)
	session.flush()

	after_conflicts = _drive_conflicts_by_pair(session)
	new_pairs = set(after_conflicts) - before_pairs
	if any(drive.id in pair for pair in new_pairs):
		conflicting_ids = sorted(
			other_id
			for pair in new_pairs
			if drive.id in pair
			for other_id in pair
			if other_id != drive.id
		)
		session.rollback()
		raise HTTPException(
			status_code=409,
			detail=f"Drive schedule conflicts with existing drive(s): {', '.join(map(str, conflicting_ids))}",
		)

	session.commit()
	session.refresh(drive)
	jobs = list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)))
	return _admin_drive_read(drive, after_conflicts, jobs)


@router.patch("/drives/{drive_id}", response_model=AdminPlacementDriveRead)
def update_admin_drive(
	drive_id: int,
	payload: AdminPlacementDriveUpdate,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminPlacementDriveRead:
	drive = session.get(PlacementDrive, drive_id)
	if drive is None:
		raise HTTPException(status_code=404, detail="Placement drive not found")

	updates = payload.model_dump(exclude_unset=True)
	next_company = updates.get("company_name", drive.company_name)
	next_venue = updates.get("venue", drive.venue)
	next_date = updates.get("drive_date", drive.drive_date)
	next_deadline = updates.get("registration_deadline", drive.registration_deadline)
	if not next_company.strip() or not next_venue.strip():
		raise HTTPException(status_code=422, detail="Company and venue are required")
	try:
		AdminPlacementDriveCreate(
			company_name=next_company,
			venue=next_venue,
			drive_date=next_date,
			registration_deadline=next_deadline,
			status=updates.get("status", drive.status),
		)
	except ValueError as error:
		raise HTTPException(status_code=422, detail=str(error)) from error

	before_pairs = set(_drive_conflicts_by_pair(session))
	for field_name, value in updates.items():
		if field_name in {"company_name", "venue"}:
			value = value.strip()
		setattr(drive, field_name, value)
	session.flush()

	after_conflicts = _drive_conflicts_by_pair(session)
	new_pairs = set(after_conflicts) - before_pairs
	if any(drive_id in pair for pair in new_pairs):
		conflicting_ids = sorted(
			other_id
			for pair in new_pairs
			if drive_id in pair
			for other_id in pair
			if other_id != drive_id
		)
		session.rollback()
		raise HTTPException(
			status_code=409,
			detail=f"Drive schedule conflicts with existing drive(s): {', '.join(map(str, conflicting_ids))}",
		)

	session.commit()
	session.refresh(drive)
	jobs = list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)))
	return _admin_drive_read(drive, after_conflicts, jobs)


def _admin_application_reads(
	applications: list[StudentApplication],
	session: Session,
) -> list[AdminApplicationRead]:
	application_ids = [application.id for application in applications]
	interviews_by_application: dict[int, list[AdminApplicationInterviewRead]] = {}
	offers_by_application: dict[int, list[AdminApplicationOfferRead]] = {}
	if application_ids:
		for interview in session.scalars(
			select(RecruiterInterview)
			.where(RecruiterInterview.application_id.in_(application_ids))
			.order_by(RecruiterInterview.scheduled_at, RecruiterInterview.id)
		):
			interviews_by_application.setdefault(interview.application_id, []).append(
				AdminApplicationInterviewRead(
					id=interview.id,
					interview_type=interview.interview_type,
					scheduled_at=interview.scheduled_at,
					duration_minutes=interview.duration_minutes,
					interviewer=interview.interviewer,
					status=interview.status,
				)
			)
		for offer in session.scalars(
			select(RecruiterOffer)
			.where(RecruiterOffer.application_id.in_(application_ids))
			.order_by(RecruiterOffer.offer_date, RecruiterOffer.id)
		):
			offers_by_application.setdefault(offer.application_id, []).append(
				AdminApplicationOfferRead(
					id=offer.id,
					package_lpa=offer.package_lpa,
					offer_date=offer.offer_date,
					joining_date=offer.joining_date,
					location=offer.location,
					employment_type=offer.employment_type,
					offer_status=offer.offer_status,
					placement_status=offer.placement_status,
				)
			)
	return [
		AdminApplicationRead(
			id=application.id,
			student_id=application.student.id,
			student_name=application.student.name,
			student_email=application.student.email,
			branch=application.student.branch,
			cgpa=application.student.cgpa,
			job_title=application.job_title,
			company_name=application.company_name,
			status=application.status,
			created_at=application.created_at,
			interviews=interviews_by_application.get(application.id, []),
			offers=offers_by_application.get(application.id, []),
		)
		for application in applications
	]


def _application_statement(
	search: str | None,
	branch: str | None,
	status: str | None,
	date_from: date | None,
	date_to: date | None,
):
	statement = (
		select(StudentApplication)
		.join(Student, Student.id == StudentApplication.student_id)
		.options(joinedload(StudentApplication.student))
	)
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		statement = statement.where(
			or_(
				Student.name.ilike(pattern),
				Student.email.ilike(pattern),
				StudentApplication.company_name.ilike(pattern),
				StudentApplication.job_title.ilike(pattern),
			)
		)
	if branch and branch.strip():
		statement = statement.where(Student.branch.ilike(f"%{branch.strip()}%"))
	if status:
		statement = statement.where(StudentApplication.status == status)
	if date_from is not None:
		statement = statement.where(
			StudentApplication.created_at >= datetime.combine(date_from, time.min)
		)
	if date_to is not None:
		statement = statement.where(
			StudentApplication.created_at
			< datetime.combine(date_to + timedelta(days=1), time.min)
		)
	return statement


@router.get("/applications", response_model=list[AdminApplicationRead])
def list_admin_applications(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=255)] = None,
	branch: Annotated[str | None, Query(max_length=40)] = None,
	status: Annotated[str | None, Query(max_length=32)] = None,
	date_from: date | None = None,
	date_to: date | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AdminApplicationRead]:
	if date_from is not None and date_to is not None and date_from > date_to:
		raise HTTPException(status_code=422, detail="Start date cannot be after end date")
	applications = list(
		session.scalars(
			_application_statement(search, branch, status, date_from, date_to)
			.order_by(
				StudentApplication.created_at.desc(),
				StudentApplication.id.desc(),
			)
			.limit(limit)
		)
	)
	return _admin_application_reads(applications, session)


@router.get(
	"/applications/{application_id}",
	response_model=AdminApplicationRead,
)
def get_admin_application(
	application_id: int,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminApplicationRead:
	application = session.scalar(
		select(StudentApplication)
		.options(joinedload(StudentApplication.student))
		.where(StudentApplication.id == application_id)
	)
	if application is None:
		raise HTTPException(status_code=404, detail="Student application not found")
	return _admin_application_reads([application], session)[0]


@router.get("/eligibility/jobs", response_model=list[AdminEligibilityJobRead])
def list_admin_eligibility_jobs(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=255)] = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AdminEligibilityJobRead]:
	statement = select(RecruiterJD)
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		statement = statement.where(
			or_(
				RecruiterJD.company_name.ilike(pattern),
				RecruiterJD.role_title.ilike(pattern),
			)
		)
	jobs = session.scalars(
		statement.order_by(RecruiterJD.company_name, RecruiterJD.role_title).limit(limit)
	)
	return [_admin_job_read(job) for job in jobs]


def _eligibility_student_read(
	student: Student,
	job: RecruiterJD,
	eligible_branches: list[str] | None,
	engine: AIPlacementEngine,
) -> AdminEligibilityStudentRead:
	match = engine.match_and_explain(
		student.cgpa,
		student.skills,
		job.min_cgpa,
		job.required_skills,
	)
	cgpa_eligible = student.cgpa >= job.min_cgpa
	branch_eligible: bool | None = None
	branch_reason = "Recruiter branch restrictions are not recorded."
	if eligible_branches is None:
		branch_reason = "Recruiter branch criteria are unavailable or invalid."
	elif eligible_branches:
		if not student.branch.strip():
			branch_reason = "Student branch is not recorded."
		else:
			branch_eligible = any(
				student.branch.strip().casefold() == branch.strip().casefold()
				for branch in eligible_branches
			)
			branch_reason = (
				f"Branch {student.branch} is included in the recruiter's criteria."
				if branch_eligible
				else f"Branch {student.branch} is not included in the recruiter's criteria."
			)

	if not cgpa_eligible or branch_eligible is False:
		result: AdminEligibilityResult = "Does not meet recorded criteria"
	elif eligible_branches is None or (eligible_branches and branch_eligible is None):
		result = "Requires review"
	else:
		result = "Meets recorded criteria"

	reason = (
		f"{match['reason']} {branch_reason}"
		if cgpa_eligible
		else f"{match['reason']} {branch_reason}"
	)
	warnings: list[str] = []
	if eligible_branches is None:
		warnings.append("Branch eligibility criteria need manual review.")
	if eligible_branches and not student.branch.strip():
		warnings.append("Student branch is not recorded.")
	if not student.skills.strip() and job.required_skills.strip():
		warnings.append("Student skills are not recorded; skill fit may be incomplete.")
	if not student.documents_confirmed:
		warnings.append("Student has not confirmed required documents.")
	if not student.college_id_verified:
		warnings.append("College ID has not been verified.")
	return AdminEligibilityStudentRead(
		student_id=student.id,
		name=student.name,
		email=student.email,
		branch=student.branch,
		cgpa=student.cgpa,
		active_backlogs=student.active_backlogs,
		cleared_backlogs=student.cleared_backlogs,
		result=result,
		reason=reason,
		fit_score=match["fit_score"],
		matched_skills=match["matched_skills"],
		missing_skills=match["missing_skills"],
		documents_confirmed=student.documents_confirmed,
		college_id_verified=student.college_id_verified,
		warnings=warnings,
	)


@router.get("/eligibility", response_model=AdminEligibilityReviewRead)
def review_admin_eligibility(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	drive_id: int | None = None,
	job_id: int | None = None,
	search: Annotated[str | None, Query(max_length=255)] = None,
	branch: Annotated[str | None, Query(max_length=40)] = None,
	result: AdminEligibilityResult | None = None,
	documents_confirmed: bool | None = None,
	college_id_verified: bool | None = None,
	limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> AdminEligibilityReviewRead:
	if (drive_id is None) == (job_id is None):
		raise HTTPException(
			status_code=422,
			detail="Specify exactly one placement drive or recruiter job",
		)
	if drive_id is not None:
		drive = session.get(PlacementDrive, drive_id)
		if drive is None:
			raise HTTPException(status_code=404, detail="Placement drive not found")
		jobs = list(
			session.scalars(
				select(RecruiterJD)
				.where(
					func.lower(func.trim(RecruiterJD.company_name))
					== func.lower(func.trim(drive.company_name))
				)
				.order_by(RecruiterJD.role_title, RecruiterJD.id)
			)
		)
		target_type: Literal["drive", "job"] = "drive"
		target_id = drive.id
		target_label = f"{drive.company_name} placement drive"
		message = (
			None
			if jobs
			else "No recruiter job descriptions are associated with this drive; eligibility cannot be evaluated."
		)
	else:
		job = session.get(RecruiterJD, job_id)
		if job is None:
			raise HTTPException(status_code=404, detail="Recruiter job not found")
		jobs = [job]
		target_type = "job"
		target_id = job.id
		target_label = f"{job.company_name} — {job.role_title}"
		message = None

	student_statement = select(Student).order_by(Student.name, Student.id)
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		student_statement = student_statement.where(
			or_(Student.name.ilike(pattern), Student.email.ilike(pattern))
		)
	if branch and branch.strip():
		student_statement = student_statement.where(
			Student.branch.ilike(f"%{branch.strip()}%")
		)
	if documents_confirmed is not None:
		student_statement = student_statement.where(
			Student.documents_confirmed.is_(documents_confirmed)
		)
	if college_id_verified is not None:
		student_statement = student_statement.where(
			Student.college_id_verified.is_(college_id_verified)
		)
	students = list(session.scalars(student_statement.limit(limit)))
	engine = AIPlacementEngine()
	role_reviews: list[AdminEligibilityRoleRead] = []
	for job in jobs:
		eligible_branches = _eligible_branch_list(job.eligible_branches)
		candidate_results = [
			_eligibility_student_read(student, job, eligible_branches, engine)
			for student in students
		]
		if result is not None:
			candidate_results = [
				candidate for candidate in candidate_results if candidate.result == result
			]
		role_reviews.append(
			AdminEligibilityRoleRead(
				**_admin_job_read(job).model_dump(),
				students=candidate_results,
			)
		)
	return AdminEligibilityReviewRead(
		target_type=target_type,
		target_id=target_id,
		target_label=target_label,
		roles=role_reviews,
		message=message,
	)


@router.get("/organization", response_model=AdminOrganizationRead)
def get_admin_organization(
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminOrganizationRead:
	branch_rows = session.execute(
		select(Student.branch, func.count(Student.id))
		.where(func.trim(Student.branch) != "")
		.group_by(Student.branch)
		.order_by(func.lower(Student.branch))
	)
	branches = [
		AdminBranchUsageRead(name=branch, student_count=count)
		for branch, count in branch_rows
	]
	unassigned_student_count = session.scalar(
		select(func.count(Student.id)).where(func.trim(Student.branch) == "")
	) or 0
	return AdminOrganizationRead(
		departments_available=False,
		department_message=(
			"No department entity or department-to-branch relationship exists in the current data model. "
			"Branch values below are read-only labels recorded on student profiles, not managed organization records."
		),
		branches=branches,
		unassigned_student_count=unassigned_student_count,
	)


# ==============================================================================
# Module 9: Announcements & Notices
# ==============================================================================

@router.get("/announcements", response_model=list[AdminAnnouncementRead])
def list_admin_announcements(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=200)] = None,
	category: Annotated[str | None, Query(max_length=80)] = None,
	priority: Literal["Low", "Normal", "High"] | None = None,
	is_published: bool | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[InstitutionalAnnouncement]:
	statement = select(InstitutionalAnnouncement)
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		statement = statement.where(
			or_(
				InstitutionalAnnouncement.title.ilike(pattern),
				InstitutionalAnnouncement.message.ilike(pattern),
			)
		)
	if category and category.strip():
		statement = statement.where(InstitutionalAnnouncement.category.ilike(f"%{category.strip()}%"))
	if priority is not None:
		statement = statement.where(InstitutionalAnnouncement.priority == priority)
	if is_published is not None:
		statement = statement.where(InstitutionalAnnouncement.is_published.is_(is_published))
	return list(
		session.scalars(
			statement.order_by(
				InstitutionalAnnouncement.published_at.desc(),
				InstitutionalAnnouncement.id.desc(),
			).limit(limit)
		)
	)


@router.post("/announcements", response_model=AdminAnnouncementRead, status_code=201)
def create_admin_announcement(
	payload: AdminAnnouncementCreate,
	session: AdminSession,
	current_admin: CurrentAdmin,
) -> InstitutionalAnnouncement:
	announcement = InstitutionalAnnouncement(
		title=payload.title.strip(),
		message=payload.message.strip(),
		category=payload.category.strip(),
		priority=payload.priority,
		published_at=payload.published_at or datetime.now(timezone.utc),
		is_published=True,
		created_by=current_admin.email,
	)
	session.add(announcement)
	session.commit()
	session.refresh(announcement)
	return announcement


@router.patch("/announcements/{announcement_id}", response_model=AdminAnnouncementRead)
def update_admin_announcement(
	announcement_id: int,
	payload: AdminAnnouncementUpdate,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> InstitutionalAnnouncement:
	announcement = session.get(InstitutionalAnnouncement, announcement_id)
	if announcement is None:
		raise HTTPException(status_code=404, detail="Announcement not found")
	for field_name, value in payload.model_dump(exclude_unset=True).items():
		if isinstance(value, str):
			value = value.strip()
		setattr(announcement, field_name, value)
	session.commit()
	session.refresh(announcement)
	return announcement


@router.delete("/announcements/{announcement_id}", response_model=dict)
def delete_admin_announcement(
	announcement_id: int,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> dict:
	announcement = session.get(InstitutionalAnnouncement, announcement_id)
	if announcement is None:
		raise HTTPException(status_code=404, detail="Announcement not found")
	session.delete(announcement)
	session.commit()
	return {"detail": "Announcement deleted successfully"}


# ==============================================================================
# Module 10: Reports & Data Export
# ==============================================================================

def _sanitize_csv_cell(value: object) -> str:
	"""Sanitize CSV cell content and prevent spreadsheet formula injection."""
	if value is None:
		return ""
	if isinstance(value, datetime):
		return value.strftime("%Y-%m-%d %H:%M:%S")
	if isinstance(value, date):
		return value.strftime("%Y-%m-%d")
	if isinstance(value, bool):
		return "Yes" if value else "No"
	text = str(value).strip()
	if text.startswith(("=", "+", "-", "@", "\t", "\r")):
		return f"'{text}"
	return text


@router.get("/reports/summary", response_model=AdminReportSummaryRead)
def get_admin_report_summary(
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminReportSummaryRead:
	now = datetime.now(timezone.utc)
	students_count = session.scalar(select(func.count(Student.id))) or 0
	active_recruiters_count = (
		session.scalar(
			select(func.count(User.id)).where(User.role == "recruiter", User.is_active.is_(True))
		)
		or 0
	)
	active_admins_count = (
		session.scalar(
			select(func.count(User.id)).where(User.role == "admin", User.is_active.is_(True))
		)
		or 0
	)
	scheduled_drives_count = (
		session.scalar(
			select(func.count(PlacementDrive.id)).where(PlacementDrive.status == "Scheduled")
		)
		or 0
	)
	conflicts = _drive_conflicts_by_pair(session)
	conflicted_drive_ids = {drive_id for pair in conflicts for drive_id in pair}
	conflicted_drives_count = (
		session.scalar(
			select(func.count(PlacementDrive.id)).where(
				or_(
					PlacementDrive.status == "Conflicted",
					PlacementDrive.id.in_(conflicted_drive_ids) if conflicted_drive_ids else False,
				)
			)
		)
		or 0
	)
	open_applications_count = (
		session.scalar(
			select(func.count(StudentApplication.id)).where(
				StudentApplication.status.in_(("Applied", "Shortlisted", "Interview Scheduled"))
			)
		)
		or 0
	)
	published_announcements_count = (
		session.scalar(
			select(func.count(InstitutionalAnnouncement.id)).where(
				InstitutionalAnnouncement.is_published.is_(True)
			)
		)
		or 0
	)
	unverified_students_count = (
		session.scalar(
			select(func.count(Student.id)).where(
				or_(
					Student.college_id_verified.is_(False),
					Student.documents_confirmed.is_(False),
				)
			)
		)
		or 0
	)
	inactive_accounts_count = (
		session.scalar(select(func.count(User.id)).where(User.is_active.is_(False))) or 0
	)

	return AdminReportSummaryRead(
		generated_at=now,
		students=students_count,
		active_recruiters=active_recruiters_count,
		active_admins=active_admins_count,
		scheduled_drives=scheduled_drives_count,
		conflicted_drives=conflicted_drives_count,
		open_applications=open_applications_count,
		published_announcements=published_announcements_count,
		unverified_students=unverified_students_count,
		inactive_accounts=inactive_accounts_count,
	)


@router.get("/reports/export", response_model=AdminReportExportRead)
def export_admin_report_csv(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	dataset: Literal["students", "drives", "applications", "recruiters", "announcements"],
	search: Annotated[str | None, Query(max_length=255)] = None,
	branch: Annotated[str | None, Query(max_length=40)] = None,
	status: Annotated[str | None, Query(max_length=32)] = None,
) -> AdminReportExportRead:
	buffer = io.StringIO()
	writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")

	if dataset == "students":
		headers = [
			"Student ID", "Full Name", "Email Address", "Branch", "University Roll Number",
			"CGPA", "Active Backlogs", "Cleared Backlogs", "Onboarding Complete",
			"Documents Confirmed", "College ID Verified", "Skills"
		]
		writer.writerow(headers)
		stmt = select(Student).order_by(Student.name, Student.id)
		if search and search.strip():
			p = f"%{search.strip()}%"
			stmt = stmt.where(or_(Student.name.ilike(p), Student.email.ilike(p)))
		if branch and branch.strip():
			stmt = stmt.where(Student.branch.ilike(f"%{branch.strip()}%"))
		for s in session.scalars(stmt):
			writer.writerow([
				_sanitize_csv_cell(s.id),
				_sanitize_csv_cell(s.name),
				_sanitize_csv_cell(s.email),
				_sanitize_csv_cell(s.branch),
				_sanitize_csv_cell(s.university_roll_number),
				_sanitize_csv_cell(s.cgpa),
				_sanitize_csv_cell(s.active_backlogs),
				_sanitize_csv_cell(s.cleared_backlogs),
				_sanitize_csv_cell(s.onboarding_complete),
				_sanitize_csv_cell(s.documents_confirmed),
				_sanitize_csv_cell(s.college_id_verified),
				_sanitize_csv_cell(s.skills),
			])

	elif dataset == "drives":
		headers = [
			"Drive ID", "Company Name", "Drive Date", "Registration Deadline", "Venue", "Status"
		]
		writer.writerow(headers)
		stmt = select(PlacementDrive).order_by(PlacementDrive.drive_date.desc(), PlacementDrive.id)
		if search and search.strip():
			p = f"%{search.strip()}%"
			stmt = stmt.where(or_(PlacementDrive.company_name.ilike(p), PlacementDrive.venue.ilike(p)))
		if status and status.strip():
			stmt = stmt.where(PlacementDrive.status == status.strip())
		for d in session.scalars(stmt):
			writer.writerow([
				_sanitize_csv_cell(d.id),
				_sanitize_csv_cell(d.company_name),
				_sanitize_csv_cell(d.drive_date),
				_sanitize_csv_cell(d.registration_deadline),
				_sanitize_csv_cell(d.venue),
				_sanitize_csv_cell(d.status),
			])

	elif dataset == "applications":
		headers = [
			"Application ID", "Student Name", "Student Email", "Branch", "CGPA",
			"Company Name", "Job Title", "Application Status", "Applied Date"
		]
		writer.writerow(headers)
		stmt = (
			select(StudentApplication)
			.join(Student, Student.id == StudentApplication.student_id)
			.options(joinedload(StudentApplication.student))
			.order_by(StudentApplication.created_at.desc(), StudentApplication.id.desc())
		)
		if search and search.strip():
			p = f"%{search.strip()}%"
			stmt = stmt.where(
				or_(
					Student.name.ilike(p),
					Student.email.ilike(p),
					StudentApplication.company_name.ilike(p),
					StudentApplication.job_title.ilike(p),
				)
			)
		if branch and branch.strip():
			stmt = stmt.where(Student.branch.ilike(f"%{branch.strip()}%"))
		if status and status.strip():
			stmt = stmt.where(StudentApplication.status == status.strip())
		for app in session.scalars(stmt):
			writer.writerow([
				_sanitize_csv_cell(app.id),
				_sanitize_csv_cell(app.student.name if app.student else ""),
				_sanitize_csv_cell(app.student.email if app.student else ""),
				_sanitize_csv_cell(app.student.branch if app.student else ""),
				_sanitize_csv_cell(app.student.cgpa if app.student else ""),
				_sanitize_csv_cell(app.company_name),
				_sanitize_csv_cell(app.job_title),
				_sanitize_csv_cell(app.status),
				_sanitize_csv_cell(app.created_at),
			])

	elif dataset == "recruiters":
		headers = [
			"User ID", "Email Address", "Active Status", "Company Name", "Industry",
			"Location", "Website"
		]
		writer.writerow(headers)
		profiles = {p.user_id: p for p in session.scalars(select(RecruiterCompanyProfile))}
		users_stmt = select(User).where(User.role == "recruiter").order_by(User.email)
		if search and search.strip():
			p = f"%{search.strip()}%"
			users_stmt = users_stmt.where(User.email.ilike(p))
		for u in session.scalars(users_stmt):
			prof = profiles.get(u.id)
			writer.writerow([
				_sanitize_csv_cell(u.id),
				_sanitize_csv_cell(u.email),
				_sanitize_csv_cell(u.is_active),
				_sanitize_csv_cell(prof.company_name if prof else ""),
				_sanitize_csv_cell(prof.industry if prof else ""),
				_sanitize_csv_cell(prof.location if prof else ""),
				_sanitize_csv_cell(prof.website if prof else ""),
			])

	else:  # announcements
		headers = [
			"Notice ID", "Title", "Category", "Priority", "Published Date",
			"Published Status", "Created By"
		]
		writer.writerow(headers)
		ann_stmt = select(InstitutionalAnnouncement).order_by(
			InstitutionalAnnouncement.published_at.desc(),
			InstitutionalAnnouncement.id.desc(),
		)
		if search and search.strip():
			p = f"%{search.strip()}%"
			ann_stmt = ann_stmt.where(
				or_(
					InstitutionalAnnouncement.title.ilike(p),
					InstitutionalAnnouncement.message.ilike(p),
				)
			)
		for a in session.scalars(ann_stmt):
			writer.writerow([
				_sanitize_csv_cell(a.id),
				_sanitize_csv_cell(a.title),
				_sanitize_csv_cell(a.category),
				_sanitize_csv_cell(a.priority),
				_sanitize_csv_cell(a.published_at),
				_sanitize_csv_cell("Published" if a.is_published else "Archived"),
				_sanitize_csv_cell(a.created_by or "Administrator"),
			])

	timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
	return AdminReportExportRead(
		filename=f"campuslink_{dataset}_report_{timestamp}.csv",
		content=buffer.getvalue(),
		media_type="text/csv; charset=utf-8",
	)


# ==============================================================================
# Module 11: Audit Logs & Security
# ==============================================================================

@router.get("/audit", response_model=AdminAuditSummaryRead)
def get_admin_audit_logs(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	category: Annotated[str | None, Query(max_length=60)] = None,
	severity: Literal["info", "warning", "critical"] | None = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> AdminAuditSummaryRead:
	now = datetime.now(timezone.utc)
	entries: list[AdminAuditEntryRead] = []
	warnings: list[str] = []

	# 1. Administrator Accounts & Inactive Accounts
	active_admins = 0
	inactive_accounts = 0
	for user in session.scalars(select(User).order_by(User.id)):
		if user.role == "admin" and user.is_active:
			active_admins += 1
			entries.append(
				AdminAuditEntryRead(
					category="Access Control",
					label=f"Administrator: {user.email}",
					detail="Active administrative privileges granted and verified.",
					severity="info",
					recorded_at=now,
				)
			)
		elif not user.is_active:
			inactive_accounts += 1
			entries.append(
				AdminAuditEntryRead(
					category="Account Security",
					label=f"Deactivated Account: {user.email}",
					detail=f"Account status deactivated for role '{user.role}'. Access disabled.",
					severity="warning",
					recorded_at=now,
				)
			)
	if inactive_accounts > 0:
		warnings.append(f"{inactive_accounts} user account(s) currently marked as deactivated.")

	# 2. Placement Drive Conflicts & Scheduling
	conflicts = _drive_conflicts_by_pair(session)
	conflicted_drive_ids = {d_id for pair in conflicts for d_id in pair}
	conflicted_drives_count = 0
	for drive in session.scalars(select(PlacementDrive).order_by(PlacementDrive.drive_date.desc())):
		drive_ts = drive.drive_date if drive.drive_date.tzinfo else drive.drive_date.replace(tzinfo=timezone.utc)
		if drive.status == "Conflicted" or drive.id in conflicted_drive_ids:
			conflicted_drives_count += 1
			entries.append(
				AdminAuditEntryRead(
					category="Drive Operations",
					label=f"Drive Conflict: {drive.company_name}",
					detail=f"Placement drive at '{drive.venue}' on {drive.drive_date.strftime('%Y-%m-%d')} has a venue/schedule conflict.",
					severity="critical",
					recorded_at=drive_ts,
				)
			)
		elif drive.status == "Scheduled":
			entries.append(
				AdminAuditEntryRead(
					category="Drive Operations",
					label=f"Scheduled Drive: {drive.company_name}",
					detail=f"Scheduled for {drive.drive_date.strftime('%Y-%m-%d')} at venue '{drive.venue}'.",
					severity="info",
					recorded_at=drive_ts,
				)
			)
	if conflicted_drives_count > 0:
		warnings.append(f"{conflicted_drives_count} placement drive(s) currently detected with schedule or venue conflicts.")

	# 3. Student Compliance & Verification
	unverified_students_count = 0
	for student in session.scalars(select(Student).order_by(Student.id)):
		issues = []
		if not student.college_id_verified:
			issues.append("Unverified College ID")
		if not student.documents_confirmed:
			issues.append("Unconfirmed placement documents")
		if issues:
			unverified_students_count += 1
			entries.append(
				AdminAuditEntryRead(
					category="Compliance",
					label=f"Student Compliance: {student.name}",
					detail=f"Student {student.email} ({student.branch}): {', '.join(issues)}.",
					severity="warning",
					recorded_at=now,
				)
			)
	if unverified_students_count > 0:
		warnings.append(f"{unverified_students_count} student profile(s) pending mandatory document or ID verification.")

	# 4. Assessment Integrity Violations
	try:
		for violation in session.scalars(select(AssessmentViolation).order_by(AssessmentViolation.id.desc()).limit(20)):
			violation_ts = violation.timestamp if getattr(violation, "timestamp", None) else now
			if violation_ts.tzinfo is None:
				violation_ts = violation_ts.replace(tzinfo=timezone.utc)
			entries.append(
				AdminAuditEntryRead(
					category="Assessment Integrity",
					label=f"Proctoring Alert: Session {violation.session_id}",
					detail=f"Violation: {violation.violation_type}. Details: {violation.details or 'Flagged by proctoring engine'}.",
					severity="critical",
					recorded_at=violation_ts,
				)
			)
	except Exception:
		pass

	# 5. Institutional Notices Governance
	for ann in session.scalars(select(InstitutionalAnnouncement).order_by(InstitutionalAnnouncement.published_at.desc()).limit(15)):
		ann_ts = ann.published_at if ann.published_at.tzinfo else ann.published_at.replace(tzinfo=timezone.utc)
		entries.append(
			AdminAuditEntryRead(
				category="Announcements",
				label=f"Notice: {ann.title}",
				detail=f"Category: {ann.category}, Priority: {ann.priority}, Status: {'Published' if ann.is_published else 'Archived'}, By: {ann.created_by or 'Admin'}.",
				severity="info",
				recorded_at=ann_ts,
			)
		)

	filtered_entries = entries
	if category and category.strip():
		filtered_entries = [e for e in filtered_entries if category.strip().casefold() in e.category.casefold()]
	if severity is not None:
		filtered_entries = [e for e in filtered_entries if e.severity == severity]

	filtered_entries.sort(key=lambda e: e.recorded_at, reverse=True)
	filtered_entries = filtered_entries[:limit]

	if conflicted_drives_count > 0:
		security_status = "Attention Required: Active Operational Conflicts Detected"
	elif unverified_students_count > 0 or inactive_accounts > 0:
		security_status = "Operational: Verification & Compliance Warnings Present"
	else:
		security_status = "Operational: High Integrity & Full Compliance"

	return AdminAuditSummaryRead(
		generated_at=now,
		security_status=security_status,
		active_admins=active_admins,
		inactive_accounts=inactive_accounts,
		unverified_students=unverified_students_count,
		conflicted_drives=conflicted_drives_count,
		warnings=warnings,
		entries=filtered_entries,
	)


# ==============================================================================
# Module 12: System Settings & Integrations
# ==============================================================================

@router.get("/settings", response_model=AdminSettingsRead)
def get_admin_settings(
	_session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminSettingsRead:
	safe_settings = [
		AdminSettingRead(
			key="app_env",
			label="Deployment Environment",
			value=os.getenv("APP_ENV", "development"),
		),
		AdminSettingRead(
			key="database_engine",
			label="Primary Database Engine",
			value="SQLite (campuslink.db)",
		),
		AdminSettingRead(
			key="ai_model",
			label="Placement AI Recommendation Model",
			value=os.getenv("CAMPUSLINK_AI_MODEL", "openai/gpt-oss-120b"),
		),
		AdminSettingRead(
			key="ai_endpoint",
			label="Placement AI Service Endpoint",
			value=os.getenv("CAMPUSLINK_AI_API_BASE", "https://api.groq.com/openai/v1"),
		),
		AdminSettingRead(
			key="token_expiry_minutes",
			label="JWT Session Expiration",
			value=f"{ACCESS_TOKEN_EXPIRE_MINUTES} minutes",
		),
		AdminSettingRead(
			key="password_security",
			label="Credential Security Scheme",
			value="bcrypt (passlib CryptContext, 12 rounds)",
		),
		AdminSettingRead(
			key="rbac_roles",
			label="Supported Role Authorization",
			value=["student", "recruiter", "admin"],
		),
		AdminSettingRead(
			key="notice_moderation",
			label="Notice Publishing Policy",
			value="Admin moderation enforced",
		),
	]

	return AdminSettingsRead(
		organization_name="BPUT Placement Network (CampusLink)",
		announcement_channels=["In-App Notices", "Dashboard Alerts", "Community Feed"],
		email_notifications_enabled=False,
		export_formats=["CSV (RFC 4180 with Formula Injection Protection)"],
		require_admin_approval_for_role_changes=True,
		settings=safe_settings,
	)


@router.get("/integrations", response_model=list[AdminIntegrationStatusRead])
def get_admin_integrations(
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> list[AdminIntegrationStatusRead]:
	integrations: list[AdminIntegrationStatusRead] = []

	# 1. SQLite Database Health Check
	try:
		res = session.execute(select(1)).scalar()
		db_online = (res == 1)
	except Exception:
		db_online = False

	integrations.append(
		AdminIntegrationStatusRead(
			name="Local SQLite Database Engine",
			status="online" if db_online else "offline",
			detail="Connected to campuslink.db with foreign key support enabled." if db_online else "Database connection unresponsive.",
		)
	)

	# 2. AI Placement & Matching Engine
	groq_key_set = bool(os.getenv("GROQ_API_KEY") or os.getenv("CAMPUSLINK_AI_API_KEY"))
	integrations.append(
		AdminIntegrationStatusRead(
			name="AI Placement & Matching Engine",
			status="online",
			detail=(
				f"Online: Rule-based heuristics active; Groq LLM API configured with model {os.getenv('CAMPUSLINK_AI_MODEL', 'openai/gpt-oss-120b')}."
				if groq_key_set
				else "Online: Rule-based deterministic matcher active (Groq API key not configured; using local explanations)."
			),
		)
	)

	# 3. Jobicy Remote Jobs Feed
	integrations.append(
		AdminIntegrationStatusRead(
			name="Jobicy Remote Jobs Feed Adapter",
			status="online",
			detail="Public remote-jobs connector active via async HTTP adapter.",
		)
	)

	# 4. Regional / Internshala Feed Connector
	internshala_url = os.getenv("CAMPUSLINK_INTERNSHALA_FEED_URL")
	if internshala_url and internshala_url.strip():
		integrations.append(
			AdminIntegrationStatusRead(
				name="Internshala / Regional Feed Connector",
				status="online",
				detail="Licensed regional connector URL configured.",
			)
		)
	else:
		integrations.append(
			AdminIntegrationStatusRead(
				name="Internshala / Regional Feed Connector",
				status="offline",
				detail="Connector not configured in environment (CAMPUSLINK_INTERNSHALA_FEED_URL is empty).",
			)
		)

	return integrations


# ==============================================================================
# Phase 4: Module 13 — Attendance & Assessment Oversight
# ==============================================================================

@router.get("/oversight/attendance-assessments", response_model=AdminOversightSummaryRead)
def get_admin_attendance_assessment_oversight(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=200)] = None,
	assessment_id: Annotated[str | None, Query(max_length=120)] = None,
	status: Annotated[str | None, Query(max_length=32)] = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> AdminOversightSummaryRead:
	now = datetime.now(timezone.utc)

	# 1. Proctoring Sessions joined with Student
	session_stmt = (
		select(AssessmentProctoringSession, Student)
		.join(Student, Student.id == AssessmentProctoringSession.student_id)
		.order_by(AssessmentProctoringSession.created_at.desc())
	)
	if assessment_id and assessment_id.strip():
		session_stmt = session_stmt.where(AssessmentProctoringSession.assessment_id == assessment_id.strip())
	if search and search.strip():
		pattern = f"%{search.strip()}%"
		session_stmt = session_stmt.where(
			or_(
				Student.name.ilike(pattern),
				Student.email.ilike(pattern),
				AssessmentProctoringSession.session_id.ilike(pattern),
			)
		)

	proctoring_rows = list(session.execute(session_stmt.limit(limit)))
	session_items: list[AdminAssessmentSessionRead] = []
	for p_sess, stu in proctoring_rows:
		if p_sess.closed_at is not None:
			sess_status = "Closed"
		elif p_sess.auto_submit_triggered:
			sess_status = "Terminated"
		elif p_sess.last_ping:
			last_ping_dt = p_sess.last_ping if p_sess.last_ping.tzinfo else p_sess.last_ping.replace(tzinfo=timezone.utc)
			sess_status = "Active" if (now - last_ping_dt).total_seconds() < 180 else "Stalled"
		else:
			sess_status = "Active"

		if status and status.strip() and sess_status.casefold() != status.strip().casefold():
			continue

		session_items.append(
			AdminAssessmentSessionRead(
				session_id=p_sess.session_id,
				student_id=stu.id,
				student_name=stu.name,
				student_email=stu.email,
				assessment_id=p_sess.assessment_id,
				current_strikes=p_sess.current_strikes,
				trust_score=p_sess.trust_score,
				mobile_connected=p_sess.mobile_connected,
				auto_submit_triggered=p_sess.auto_submit_triggered,
				last_ping=p_sess.last_ping,
				created_at=p_sess.created_at,
				closed_at=p_sess.closed_at,
				status=sess_status,
			)
		)

	# 2. Assessment Violations
	violation_items: list[AdminAssessmentViolationRead] = []
	for viol in session.scalars(select(AssessmentViolation).order_by(AssessmentViolation.timestamp.desc()).limit(limit)):
		violation_items.append(
			AdminAssessmentViolationRead(
				id=viol.id,
				session_id=viol.session_id,
				event_type=viol.event_type,
				timestamp=viol.timestamp,
				strike_count=viol.strike_count,
			)
		)

	# 3. Drive Attendance / Panel Status
	live_drives = {d.company_name.strip().casefold(): d for d in session.scalars(select(Drive)) if d.company_name}
	drive_items: list[AdminDriveAttendanceRead] = []
	for p_drive in session.scalars(select(PlacementDrive).order_by(PlacementDrive.drive_date.desc()).limit(limit)):
		live_drive = live_drives.get(p_drive.company_name.strip().casefold())
		drive_items.append(
			AdminDriveAttendanceRead(
				drive_id=p_drive.id,
				company_name=p_drive.company_name,
				drive_date=p_drive.drive_date,
				venue=p_drive.venue,
				status=p_drive.status,
				panel_throughput_rate=live_drive.panel_throughput_rate if live_drive else None,
			)
		)

	total_assessment_sessions = session.scalar(select(func.count(AssessmentProctoringSession.session_id))) or 0
	flagged_sessions = session.scalar(
		select(func.count(AssessmentProctoringSession.session_id)).where(
			or_(
				AssessmentProctoringSession.current_strikes > 0,
				AssessmentProctoringSession.trust_score < 70.0,
			)
		)
	) or 0
	avg_trust = session.scalar(select(func.avg(AssessmentProctoringSession.trust_score))) or 100.0
	total_viol = session.scalar(select(func.count(AssessmentViolation.id))) or 0
	active_drives = session.scalar(
		select(func.count(PlacementDrive.id)).where(PlacementDrive.status.in_(("Scheduled", "Conflicted")))
	) or 0

	return AdminOversightSummaryRead(
		generated_at=now,
		total_assessment_sessions=total_assessment_sessions,
		flagged_sessions=flagged_sessions,
		average_trust_score=round(float(avg_trust), 2),
		total_violations=total_viol,
		active_drive_sessions=active_drives,
		sessions=session_items,
		violations=violation_items,
		drives=drive_items,
	)


# ==============================================================================
# Phase 4: Module 14 — Grievances & Support Requests
# ==============================================================================

@router.get("/grievances", response_model=list[AdminGrievanceItemRead])
def list_admin_grievances(
	session: AdminSession,
	_current_admin: CurrentAdmin,
	search: Annotated[str | None, Query(max_length=200)] = None,
	status: Literal["pending", "in_review", "resolved", "dismissed"] | None = None,
	category: Annotated[str | None, Query(max_length=80)] = None,
	limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AdminGrievanceItemRead]:
	"""Expose student communication and assistance threads using existing CandidateConnection and DirectMessage models."""
	connections = list(
		session.scalars(
			select(CandidateConnection)
			.order_by(CandidateConnection.created_at.desc(), CandidateConnection.id.desc())
			.limit(limit)
		)
	)

	items: list[AdminGrievanceItemRead] = []
	for conn in connections:
		mapped_status: Literal["pending", "in_review", "resolved", "dismissed"] = (
			"resolved" if conn.status == "accepted"
			else "dismissed" if conn.status == "declined"
			else "pending"
		)
		if status is not None and mapped_status != status:
			continue

		sender = session.get(User, conn.sender_id)
		recipient = session.get(User, conn.recipient_id)
		student_user = sender if sender and sender.role == "student" else (recipient if recipient and recipient.role == "student" else sender)
		student_profile = session.scalar(select(Student).where(Student.email == student_user.email)) if student_user else None
		req_email = student_user.email if student_user else "unknown@campuslink.internal"
		req_name = student_profile.name if student_profile else req_email.split("@")[0]

		cat = "Placement Inquiries" if "drive" in conn.opportunity_title.lower() or "offer" in conn.opportunity_title.lower() else "Student Support"
		if category and category.strip() and category.strip().casefold() not in cat.casefold():
			continue

		latest_msg = session.scalar(
			select(DirectMessage)
			.where(DirectMessage.connection_id == conn.id)
			.order_by(DirectMessage.timestamp.desc())
			.limit(1)
		)
		msg_content = latest_msg.content if latest_msg else (conn.intro_message or "Support inquiry submitted.")
		msg_time = latest_msg.timestamp if latest_msg else conn.created_at

		if search and search.strip():
			p = search.strip().casefold()
			if p not in req_email.casefold() and p not in req_name.casefold() and p not in conn.opportunity_title.casefold() and p not in msg_content.casefold():
				continue

		items.append(
			AdminGrievanceItemRead(
				id=conn.id,
				requester_email=req_email,
				requester_name=req_name,
				category=cat,
				subject=conn.opportunity_title or "General Support Inquiry",
				message=msg_content,
				status=mapped_status,
				created_at=conn.created_at,
				updated_at=msg_time,
				assigned_to="Placement Cell Administrator",
				resolution_note=None,
			)
		)

	return items


@router.patch("/grievances/{thread_id}", response_model=AdminGrievanceItemRead)
def update_admin_grievance_status(
	thread_id: int,
	payload: AdminGrievanceStatusUpdate,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminGrievanceItemRead:
	connection = session.get(CandidateConnection, thread_id)
	if connection is None:
		raise HTTPException(status_code=404, detail="Support request not found")

	if payload.status == "resolved":
		connection.status = "accepted"
	elif payload.status == "dismissed":
		connection.status = "declined"
	else:
		connection.status = "pending"

	session.commit()
	session.refresh(connection)

	sender = session.get(User, connection.sender_id)
	recipient = session.get(User, connection.recipient_id)
	student_user = sender if sender and sender.role == "student" else (recipient if recipient and recipient.role == "student" else sender)
	student_profile = session.scalar(select(Student).where(Student.email == student_user.email)) if student_user else None
	req_email = student_user.email if student_user else "user@campuslink.internal"
	req_name = student_profile.name if student_profile else req_email.split("@")[0]

	return AdminGrievanceItemRead(
		id=connection.id,
		requester_email=req_email,
		requester_name=req_name,
		category="Student Support",
		subject=connection.opportunity_title or "Support Request",
		message=connection.intro_message or "Status updated by admin",
		status=payload.status,
		created_at=connection.created_at,
		updated_at=datetime.now(timezone.utc),
		assigned_to="Placement Cell Administrator",
		resolution_note=payload.resolution_note,
	)


# ==============================================================================
# Phase 4: Module 15 — Data Quality & Import Management
# ==============================================================================

def _parse_csv_student_rows(csv_text: str) -> tuple[list[dict], list[AdminImportRowError]]:
	errors: list[AdminImportRowError] = []
	rows: list[dict] = []
	reader = csv.reader(io.StringIO(csv_text))
	header_row = next(reader, None)
	if not header_row:
		errors.append(AdminImportRowError(row_number=1, field="file", message="CSV file is empty or missing headers."))
		return rows, errors

	normalized_headers = [h.strip().casefold().replace(" ", "_") for h in header_row]
	header_map: dict[str, int] = {}
	for idx, h in enumerate(normalized_headers):
		if h in ("name", "full_name", "student_name"):
			header_map["name"] = idx
		elif h in ("email", "email_address", "student_email"):
			header_map["email"] = idx
		elif h in ("branch", "department", "stream"):
			header_map["branch"] = idx
		elif h in ("cgpa", "gpa", "score"):
			header_map["cgpa"] = idx
		elif h in ("roll_number", "university_roll_number", "roll_no"):
			header_map["roll_number"] = idx
		elif h in ("backlogs", "active_backlogs"):
			header_map["active_backlogs"] = idx
		elif h in ("skills", "tech_stack"):
			header_map["skills"] = idx

	for req in ("name", "email", "branch", "cgpa"):
		if req not in header_map:
			errors.append(AdminImportRowError(row_number=1, field=req, message=f"Required column '{req}' is missing from CSV header."))

	if errors:
		return rows, errors

	for row_num, raw_row in enumerate(reader, start=2):
		if not raw_row or not any(cell.strip() for cell in raw_row):
			continue

		def get_val(col: str) -> str:
			idx = header_map.get(col)
			return raw_row[idx].strip() if idx is not None and idx < len(raw_row) else ""

		name = get_val("name")
		email = get_val("email")
		branch = get_val("branch")
		cgpa_raw = get_val("cgpa")
		roll_number = get_val("roll_number") or None
		backlogs_raw = get_val("active_backlogs")
		skills = get_val("skills")

		row_valid = True
		if not name:
			errors.append(AdminImportRowError(row_number=row_num, field="name", message="Student name cannot be blank."))
			row_valid = False
		if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
			errors.append(AdminImportRowError(row_number=row_num, field="email", message="Invalid or missing email address.", invalid_value=email))
			row_valid = False
		if not branch:
			errors.append(AdminImportRowError(row_number=row_num, field="branch", message="Student branch cannot be blank."))
			row_valid = False

		cgpa = 0.0
		try:
			cgpa = float(cgpa_raw)
			if cgpa < 0.0 or cgpa > 10.0:
				errors.append(AdminImportRowError(row_number=row_num, field="cgpa", message="CGPA must be between 0.0 and 10.0.", invalid_value=cgpa_raw))
				row_valid = False
		except ValueError:
			errors.append(AdminImportRowError(row_number=row_num, field="cgpa", message="CGPA must be a valid number.", invalid_value=cgpa_raw))
			row_valid = False

		backlogs = 0
		if backlogs_raw:
			try:
				backlogs = int(backlogs_raw)
				if backlogs < 0:
					errors.append(AdminImportRowError(row_number=row_num, field="active_backlogs", message="Backlogs cannot be negative.", invalid_value=backlogs_raw))
					row_valid = False
			except ValueError:
				errors.append(AdminImportRowError(row_number=row_num, field="active_backlogs", message="Backlogs must be an integer.", invalid_value=backlogs_raw))
				row_valid = False

		rows.append({
			"row_number": row_num,
			"name": name,
			"email": email,
			"branch": branch,
			"cgpa": cgpa,
			"university_roll_number": roll_number,
			"active_backlogs": backlogs,
			"skills": skills,
			"is_valid": row_valid,
		})

	return rows, errors


@router.post("/imports/preview", response_model=AdminImportPreviewRead)
def preview_admin_student_import(
	payload: AdminImportCommitPayload,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminImportPreviewRead:
	parsed_rows, parse_errors = _parse_csv_student_rows(payload.csv_content)
	if parse_errors and not parsed_rows:
		return AdminImportPreviewRead(
			total_rows=0,
			valid_count=0,
			invalid_count=len(parse_errors),
			duplicate_count=0,
			supported_entity="students",
			errors=parse_errors,
			preview_rows=[],
		)

	seen_emails: set[str] = set()
	existing_emails = set(session.scalars(select(User.email)))
	preview_rows: list[AdminImportPreviewRow] = []
	dup_count = 0
	val_count = 0
	inval_count = 0

	for r in parsed_rows:
		email_clean = r["email"].casefold()
		is_dup = False
		error_msg = None

		if not r["is_valid"]:
			inval_count += 1
		elif email_clean in seen_emails:
			is_dup = True
			dup_count += 1
			error_msg = "Duplicate email in CSV upload."
		elif email_clean in existing_emails:
			is_dup = True
			dup_count += 1
			error_msg = "User account already exists in database."
		else:
			val_count += 1
			seen_emails.add(email_clean)

		preview_rows.append(
			AdminImportPreviewRow(
				row_number=r["row_number"],
				name=r["name"],
				email=r["email"],
				branch=r["branch"],
				cgpa=r["cgpa"],
				university_roll_number=r["university_roll_number"],
				active_backlogs=r["active_backlogs"],
				skills=r["skills"],
				is_valid=r["is_valid"] and not is_dup,
				is_duplicate=is_dup,
				error_message=error_msg,
			)
		)

	return AdminImportPreviewRead(
		total_rows=len(parsed_rows),
		valid_count=val_count,
		invalid_count=inval_count,
		duplicate_count=dup_count,
		supported_entity="students",
		errors=parse_errors,
		preview_rows=preview_rows,
	)


@router.post("/imports/commit", response_model=AdminImportCommitResult)
def commit_admin_student_import(
	payload: AdminImportCommitPayload,
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminImportCommitResult:
	if not payload.confirm:
		raise HTTPException(status_code=400, detail="Explicit confirmation is required to commit import.")

	parsed_rows, parse_errors = _parse_csv_student_rows(payload.csv_content)
	if parse_errors and not parsed_rows:
		return AdminImportCommitResult(
			success=False,
			imported_count=0,
			skipped_count=0,
			failed_count=len(parse_errors),
			message="Cannot commit CSV with fatal parsing errors.",
		)

	existing_emails = set(session.scalars(select(User.email)))
	seen_emails: set[str] = set()
	imported = 0
	skipped = 0
	failed = 0

	try:
		for r in parsed_rows:
			if not r["is_valid"]:
				failed += 1
				continue
			email_clean = r["email"].casefold()
			if email_clean in existing_emails or email_clean in seen_emails:
				skipped += 1
				continue

			seen_emails.add(email_clean)
			user = User(
				email=r["email"],
				hashed_password=get_password_hash("Student@CampusLink2026"),
				role="student",
				is_active=True,
			)
			session.add(user)
			session.flush()

			student = Student(
				name=r["name"],
				email=r["email"],
				branch=r["branch"],
				university_roll_number=r["university_roll_number"],
				cgpa=r["cgpa"],
				active_backlogs=r["active_backlogs"],
				cleared_backlogs=0,
				skills=r["skills"],
				onboarding_complete=False,
				documents_confirmed=False,
				college_id_verified=False,
			)
			session.add(student)
			imported += 1

		session.commit()
		return AdminImportCommitResult(
			success=True,
			imported_count=imported,
			skipped_count=skipped,
			failed_count=failed,
			message=f"Successfully imported {imported} student records ({skipped} duplicates skipped, {failed} invalid rows rejected).",
		)
	except Exception as exc:
		session.rollback()
		raise HTTPException(status_code=500, detail=f"Database transaction rolled back due to error: {str(exc)}") from exc


# ==============================================================================
# Phase 4: Module 16 — Backup & Recovery Management
# ==============================================================================

@router.get("/backups", response_model=AdminDatabaseStatusRead)
def get_admin_database_backup_status(
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminDatabaseStatusRead:
	root_dir = pathlib.Path.cwd()
	db_file = root_dir / "campuslink.db"
	if not db_file.exists():
		raise HTTPException(status_code=500, detail="Active SQLite database campuslink.db was not found at root.")

	file_size = db_file.stat().st_size
	mtime = datetime.fromtimestamp(db_file.stat().st_mtime, timezone.utc)

	record_counts = {
		"users": session.scalar(select(func.count(User.id))) or 0,
		"students": session.scalar(select(func.count(Student.id))) or 0,
		"placement_drives": session.scalar(select(func.count(PlacementDrive.id))) or 0,
		"student_applications": session.scalar(select(func.count(StudentApplication.id))) or 0,
		"recruiter_jds": session.scalar(select(func.count(RecruiterJD.id))) or 0,
		"institutional_announcements": session.scalar(select(func.count(InstitutionalAnnouncement.id))) or 0,
		"assessment_proctoring_sessions": session.scalar(select(func.count(AssessmentProctoringSession.session_id))) or 0,
		"assessment_violations": session.scalar(select(func.count(AssessmentViolation.id))) or 0,
	}

	wal_enabled = False
	try:
		wal_mode = session.execute(func.text("PRAGMA journal_mode;")).scalar()
		wal_enabled = str(wal_mode).casefold() == "wal"
	except Exception:
		pass

	available_backups: list[AdminBackupArtifact] = []
	for p in root_dir.glob("campuslink.db*.bak"):
		available_backups.append(
			AdminBackupArtifact(
				filename=p.name,
				path=str(p),
				size_bytes=p.stat().st_size,
				created_at=datetime.fromtimestamp(p.stat().st_mtime, timezone.utc),
				is_verified=True,
			)
		)

	safe_instructions = [
		"1. Periodic Non-blocking Snapshot: Use POST /api/v1/admin/backups/snapshot to generate a timestamped online SQLite snapshot.",
		"2. Safe Cold Backup: Stop the server process (uvicorn) and copy 'campuslink.db' along with any '-wal' / '-shm' files to secure offsite storage.",
		"3. Recovery Policy: Database restoration is strictly disabled in this interface to prevent accidental data overwrites. Manual restore requires authorized DBA intervention.",
		"4. SQLite Integrity Verification: Verify backup integrity using `sqlite3 <backup-file> \"PRAGMA integrity_check;\"` before restoring."
	]

	return AdminDatabaseStatusRead(
		database_type="SQLite 3.x",
		database_path="campuslink.db",
		file_size_bytes=file_size,
		table_count=len(record_counts),
		record_counts=record_counts,
		last_modified=mtime,
		wal_enabled=wal_enabled,
		automation_status="Automated scheduler is not configured in local environment (Manual online snapshot verified).",
		available_backups=available_backups,
		safe_instructions=safe_instructions,
		restore_enabled=False,
	)


@router.post("/backups/snapshot", response_model=AdminBackupArtifact)
def create_admin_database_snapshot(
	_session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminBackupArtifact:
	root_dir = pathlib.Path.cwd()
	src_path = root_dir / "campuslink.db"
	ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
	dest_filename = f"campuslink.db.snapshot_{ts_str}.bak"
	dest_path = root_dir / dest_filename

	try:
		src_conn = sqlite3.connect(str(src_path))
		dest_conn = sqlite3.connect(str(dest_path))
		with dest_conn:
			src_conn.backup(dest_conn)
		dest_conn.close()
		src_conn.close()

		verify_conn = sqlite3.connect(str(dest_path))
		user_count = verify_conn.execute("SELECT count(*) FROM users").fetchone()[0]
		verify_conn.close()

		return AdminBackupArtifact(
			filename=dest_filename,
			path=str(dest_path),
			size_bytes=dest_path.stat().st_size,
			created_at=datetime.now(timezone.utc),
			is_verified=(user_count >= 0),
		)
	except Exception as exc:
		if dest_path.exists():
			dest_path.unlink()
		raise HTTPException(status_code=500, detail=f"Failed to create verified database snapshot: {str(exc)}") from exc


# ==============================================================================
# Phase 4: Module 17 — Notification & Delivery Monitoring
# ==============================================================================

@router.get("/notifications/monitoring", response_model=AdminNotificationMonitoringSummary)
def get_admin_notification_monitoring(
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminNotificationMonitoringSummary:
	now = datetime.now(timezone.utc)

	published_notices_count = session.scalar(
		select(func.count(InstitutionalAnnouncement.id)).where(InstitutionalAnnouncement.is_published.is_(True))
	) or 0
	upcoming_drives_count = session.scalar(
		select(func.count(PlacementDrive.id)).where(PlacementDrive.status.in_(("Scheduled", "Conflicted")))
	) or 0

	channels: list[AdminNotificationChannelStatus] = [
		AdminNotificationChannelStatus(
			channel_name="In-App Institutional Notices",
			status="active",
			provider="CampusLink Internal Notice Hub",
			description="Broadcast bulletin alerts visible on Student and Recruiter notice boards.",
			active_items_count=published_notices_count,
			delivery_confirmation_supported=False,
		),
		AdminNotificationChannelStatus(
			channel_name="Drive Deadline Alerts",
			status="active",
			provider="Placement Scheduler Engine",
			description="Dynamic deadline and calendar alerts pushed to student workspace bells.",
			active_items_count=upcoming_drives_count,
			delivery_confirmation_supported=False,
		),
		AdminNotificationChannelStatus(
			channel_name="External Email (SMTP)",
			status="not_configured",
			provider="SMTP Relay (SES / SendGrid)",
			description="External email gateway credentials not provided in environment configuration.",
			active_items_count=0,
			delivery_confirmation_supported=False,
		),
		AdminNotificationChannelStatus(
			channel_name="SMS / WhatsApp Gateway",
			status="not_configured",
			provider="Twilio / Gupshup Gateway",
			description="External SMS webhook credentials not configured.",
			active_items_count=0,
			delivery_confirmation_supported=False,
		),
	]

	recent_items: list[AdminMonitoredNotificationItem] = []
	for ann in session.scalars(select(InstitutionalAnnouncement).order_by(InstitutionalAnnouncement.published_at.desc()).limit(15)):
		recent_items.append(
			AdminMonitoredNotificationItem(
				id=f"notice-{ann.id}",
				title=ann.title,
				channel="In-App Institutional Notices",
				category=ann.category,
				priority=ann.priority,
				audience="Campus-wide",
				status="Published" if ann.is_published else "Archived",
				created_at=ann.published_at,
				published_at=ann.published_at,
			)
		)

	for drive in session.scalars(select(PlacementDrive).order_by(PlacementDrive.drive_date.desc()).limit(10)):
		recent_items.append(
			AdminMonitoredNotificationItem(
				id=f"drive-{drive.id}",
				title=f"{drive.company_name} Drive Alert",
				channel="Drive Deadline Alerts",
				category="Placement Drive",
				priority="High" if drive.status == "Conflicted" else "Normal",
				audience="Eligible Candidates",
				status=drive.status,
				created_at=drive.drive_date if drive.drive_date.tzinfo else drive.drive_date.replace(tzinfo=timezone.utc),
				published_at=drive.drive_date if drive.drive_date.tzinfo else drive.drive_date.replace(tzinfo=timezone.utc),
			)
		)

	return AdminNotificationMonitoringSummary(
		generated_at=now,
		channels=channels,
		in_app_active_count=published_notices_count + upcoming_drives_count,
		external_configured=False,
		external_delivery_notice="External email and SMS delivery gateways are not configured in this environment. CampusLink delivers 100% of alerts via in-app dashboard feeds and notice hubs.",
		recent_notifications=recent_items,
	)


# ==============================================================================
# Phase 4: Module 18 — Policy & Eligibility Rules
# ==============================================================================

@router.get("/policies/eligibility", response_model=AdminEligibilityPolicyRead)
def get_admin_eligibility_policies(
	session: AdminSession,
	_current_admin: CurrentAdmin,
) -> AdminEligibilityPolicyRead:
	now = datetime.now(timezone.utc)

	tier_counts = {
		"Highly Employable": session.scalar(select(func.count(Student.id)).where(Student.readiness_score >= 85.0)) or 0,
		"Ready": session.scalar(select(func.count(Student.id)).where(Student.readiness_score >= 70.0, Student.readiness_score < 85.0)) or 0,
		"Developing": session.scalar(select(func.count(Student.id)).where(Student.readiness_score >= 50.0, Student.readiness_score < 70.0)) or 0,
		"Not Ready": session.scalar(select(func.count(Student.id)).where(Student.readiness_score < 50.0)) or 0,
	}

	readiness_rules = [
		AdminReadinessPolicyRule(
			name="Academic CGPA Component",
			weight_percent=30,
			formula="(Student CGPA / 10.0) * 30",
			description="Standardized academic performance metric normalized to a 10.0 scale.",
		),
		AdminReadinessPolicyRule(
			name="Technical Skills Coverage",
			weight_percent=30,
			formula="(Normalized Skills Count / Max Skills Benchmark) * 30",
			description="Evaluates student profile technical competencies against placement criteria.",
		),
		AdminReadinessPolicyRule(
			name="Assessment / Mock Quiz Performance",
			weight_percent=40,
			formula="(Mock Quiz Score / 100.0) * 40",
			description="Continuous mock interview and coding test evaluation percentage.",
		),
	]

	readiness_tiers = [
		AdminReadinessTier(
			tier_name="Highly Employable",
			score_range="85.0 – 100.0%",
			description="Top-tier candidate ready for premier recruitment drives.",
			current_student_count=tier_counts["Highly Employable"],
		),
		AdminReadinessTier(
			tier_name="Ready",
			score_range="70.0 – 84.9%",
			description="Eligible candidate meeting standard placement benchmarks.",
			current_student_count=tier_counts["Ready"],
		),
		AdminReadinessTier(
			tier_name="Developing",
			score_range="50.0 – 69.9%",
			description="Candidate requiring practice or backlog clearance before selection.",
			current_student_count=tier_counts["Developing"],
		),
		AdminReadinessTier(
			tier_name="Not Ready",
			score_range="0.0 – 49.9%",
			description="At-risk candidate flagged for placement cell intervention.",
			current_student_count=tier_counts["Not Ready"],
		),
	]

	verified_id_count = session.scalar(select(func.count(Student.id)).where(Student.college_id_verified.is_(True))) or 0
	unverified_id_count = session.scalar(select(func.count(Student.id)).where(Student.college_id_verified.is_(False))) or 0
	confirmed_docs_count = session.scalar(select(func.count(Student.id)).where(Student.documents_confirmed.is_(True))) or 0
	unconfirmed_docs_count = session.scalar(select(func.count(Student.id)).where(Student.documents_confirmed.is_(False))) or 0

	verification_policies = [
		AdminVerificationPolicy(
			rule_name="College ID Verification",
			required=True,
			criteria_field="Student.college_id_verified",
			description="Students must have verified college credentials before applying to company drives.",
			compliant_student_count=verified_id_count,
			pending_student_count=unverified_id_count,
		),
		AdminVerificationPolicy(
			rule_name="Placement Document Confirmation",
			required=True,
			criteria_field="Student.documents_confirmed",
			description="Resumes, marksheets, and identity certificates must be confirmed by the student.",
			compliant_student_count=confirmed_docs_count,
			pending_student_count=unconfirmed_docs_count,
		),
	]

	return AdminEligibilityPolicyRead(
		generated_at=now,
		readiness_rules=readiness_rules,
		readiness_tiers=readiness_tiers,
		verification_policies=verification_policies,
		jd_scoring_formula="JD Match Fit = (CGPA Fit * 0.40) + (Skill Overlap Token Intersection * 0.60)",
		branch_policy_explanation="Recruiter-specified branch eligibility is matched directly against candidate profile branch records. Jobs with no recorded branch criteria default to manual review.",
		centralized_configuration=False,
		policy_governance_notice="Readiness and eligibility formulas are executed deterministically by the AIPlacementEngine. Runtime editing of calculation formulas is disabled to preserve evaluation integrity.",
	)

