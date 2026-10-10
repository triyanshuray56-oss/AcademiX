import re
import os
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.ai.ai_engine import AIPlacementEngine
from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models.growth import capture_daily_snapshot
from backend.app.models import MatchRecord, PlacementDrive, RecruiterJD, Student, StudentApplication, User
from backend.app.schemas.api import (
	DeepProfileMatchFactor,
	MessageResponse,
	NudgeRecommendation,
	StudentDeepProfileResponse,
	StudentDashboardAnalytics,
	StudentNudgeResponse,
)
from backend.app.schemas.student import (
	Student as StudentResponse,
	CollegeIdVerificationUpdate,
	StudentCreate,
	StudentAssessmentUpdate,
	StudentOnboarding,
	StudentUpdate,
)

router = APIRouter(prefix="/students", tags=["students"])

SKILL_ALIASES = {
	"python 3": "python",
	"react js": "react",
	"reactjs": "react",
	"react.js": "react",
	"amazon web services": "aws",
	"ml": "machine learning",
}


def _skill_key(value: str) -> str:
	normalized = re.sub(r"[^a-z0-9+#.]+", " ", value.casefold()).strip()
	return SKILL_ALIASES.get(normalized, normalized)


def _skill_parts(value: str) -> list[str]:
	return [part.strip() for part in re.split(r"[,;|\n]", value) if part.strip()]


@router.get("", response_model=list[StudentResponse])
def list_students(session: Session = Depends(get_db)) -> list[Student]:
	"""Return all student profiles in stable ID order."""
	return list(session.scalars(select(Student).order_by(Student.id)))


@router.get("/{student_id}/deep-profile", response_model=StudentDeepProfileResponse)
def get_student_deep_profile(
	student_id: int,
	session: Session = Depends(get_db),
	_current_user: User = Depends(require_roles("admin", "recruiter")),
) -> StudentDeepProfileResponse:
	"""Return the candidate's full profile and active-drive explainability factors."""
	student = session.get(Student, student_id)
	if student is None:
		raise HTTPException(status_code=404, detail="Student not found")

	active_drives = session.scalars(
		select(PlacementDrive)
		.where(PlacementDrive.status.in_(("Scheduled", "Conflicted")))
		.order_by(PlacementDrive.drive_date, PlacementDrive.id)
	)
	existing_matches = session.scalars(
		select(MatchRecord).where(MatchRecord.student_id == student_id)
	)
	matches_by_jd = {record.jd_id: record for record in existing_matches}
	engine = AIPlacementEngine()
	match_factors: list[DeepProfileMatchFactor] = []
	for drive in active_drives:
		drive_jds = session.scalars(
			select(RecruiterJD).where(
				func.lower(RecruiterJD.company_name)
				== drive.company_name.strip().casefold()
			)
		)
		for jd in drive_jds:
			result = engine.match_and_explain(
				student.cgpa,
				student.skills,
				jd.min_cgpa,
				jd.required_skills,
			)
			record = matches_by_jd.get(jd.id)
			match_factors.append(
				DeepProfileMatchFactor(
					drive_id=drive.id,
					company_name=drive.company_name,
					jd_id=jd.id,
					role_title=jd.role_title,
					fit_score=result["fit_score"],
					min_cgpa=jd.min_cgpa,
					cgpa_eligible=student.cgpa >= jd.min_cgpa,
					matched_skills=result["matched_skills"],
					missing_skills=result["missing_skills"],
					reason=result["reason"],
					match_record_id=record.id if record else None,
					match_status=record.status if record else None,
					recruiter_action_status=(
						record.recruiter_action_status if record else "Not Actioned"
					),
				)
			)
	return StudentDeepProfileResponse(
		student=student,
		active_drive_match_factors=match_factors,
	)


@router.get("/me", response_model=StudentResponse)
def get_my_student_profile(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> Student:
	"""Return the authenticated student's profile or a not-linked response."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	capture_daily_snapshot(session, student)
	return student


@router.get("/me/dashboard-analytics", response_model=StudentDashboardAnalytics)
def get_my_dashboard_analytics(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> StudentDashboardAnalytics:
	"""Return anonymized branch benchmarks and this student's active drive-match funnel."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	branch_filter = func.upper(func.trim(Student.branch)) == student.branch.strip().upper()
	branch_average_coding, branch_average_leetcode, branch_student_count = session.execute(
		select(
			func.avg(Student.coding_score),
			func.avg(Student.leetcode_rating),
			func.count(Student.id),
		).where(branch_filter)
	).one()
	active_jd_ids = select(RecruiterJD.id).join(
		PlacementDrive,
		func.lower(func.trim(RecruiterJD.company_name))
		== func.lower(func.trim(PlacementDrive.company_name)),
	).where(PlacementDrive.status.in_(("Scheduled", "Conflicted")))
	records = list(session.scalars(
		select(MatchRecord).where(
			MatchRecord.student_id == student.id,
			MatchRecord.jd_id.in_(active_jd_ids),
		)
	))
	applications = list(session.scalars(
		select(StudentApplication).where(StudentApplication.student_id == student.id)
	))
	shortlisted_stages = {"Shortlisted", "Interview Scheduled", "Offer Extended"}
	interview_stages = {"Interview Scheduled", "Offer Extended"}
	tracked_count = len(records) + len(applications)
	is_demo_data = False
	pipeline_counts = {
		"Applied": tracked_count,
		"Shortlisted": sum(record.recruiter_action_status in shortlisted_stages for record in records),
		"Interview Scheduled": sum(record.recruiter_action_status in interview_stages for record in records),
		"Offer Extended": sum(record.recruiter_action_status == "Offer Extended" for record in records),
	}
	if tracked_count == 0 and os.getenv("APP_ENV", "development").casefold() != "production":
		pipeline_counts = {"Applied": 3, "Shortlisted": 2, "Interview Scheduled": 1, "Offer Extended": 0}
		tracked_count = 3
		is_demo_data = True
	return StudentDashboardAnalytics(
		branch_average_coding=(round(float(branch_average_coding), 1) if branch_average_coding is not None else None),
		branch_average_leetcode=(round(float(branch_average_leetcode), 1) if branch_average_leetcode is not None else None),
		branch_student_count=int(branch_student_count or 0),
		tracked_match_count=tracked_count,
		pipeline_counts=pipeline_counts,
		is_demo_data=is_demo_data,
	)


@router.post("/me/assessments", response_model=StudentResponse)
def update_my_assessment_scores(
	payload: StudentAssessmentUpdate,
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> Student:
	"""Save the authenticated student's mock interview and assessment scores."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	for field_name, value in payload.model_dump().items():
		setattr(student, field_name, value)
	student.readiness_score, student.readiness_status = AIPlacementEngine().calculate_readiness(
		student.cgpa,
		student.verified_tech_stack or student.skills,
		student.mock_interview_score,
	)
	session.commit()
	session.refresh(student)
	return student


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, session: Session = Depends(get_db)) -> Student:
	student = session.get(Student, student_id)
	if student is None:
		raise HTTPException(status_code=404, detail="Student not found")
	return student


@router.patch("/{student_id}/college-id-verification", response_model=StudentResponse)
def update_college_id_verification(
	student_id: int,
	payload: CollegeIdVerificationUpdate,
	session: Session = Depends(get_db),
	_current_user: User = Depends(require_roles("admin")),
) -> Student:
	student = session.get(Student, student_id)
	if student is None:
		raise HTTPException(status_code=404, detail="Student not found")
	if payload.college_id_verified and not student.college_id_card_url:
		raise HTTPException(status_code=409, detail="Upload a College ID card before verifying it")
	student.college_id_verified = payload.college_id_verified
	session.commit()
	session.refresh(student)
	return student


@router.post("/profile", response_model=StudentResponse)
def upsert_my_student_profile(
	payload: StudentOnboarding,
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> Student:
	"""Create or update an onboarding profile, linked to the JWT user's email."""
	profile_data = payload.model_dump()
	verified_stack = profile_data["verified_tech_stack"]
	skills = ", ".join(verified_stack)
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	mock_score = student.mock_interview_score if student is not None else 0.0
	score, readiness_status = AIPlacementEngine().calculate_readiness(
		profile_data["cgpa"],
		verified_stack,
		mock_score,
	)
	if student is None:
		student = Student(
			email=current_user.email,
			mock_interview_score=mock_score,
			**profile_data,
			skills=skills,
			readiness_score=score,
			readiness_status=readiness_status,
			onboarding_complete=True,
		)
		session.add(student)
	else:
		# Older clients may omit collection fields. Preserve those values; a
		# submitted list replaces that domain as one atomic JSON update.
		provided_fields = payload.model_fields_set
		for collection_field in (
			"internship_experiences",
			"project_showcase",
			"responsibilities",
			"accomplishments",
			"volunteering",
			"extracurriculars",
		):
			if collection_field not in provided_fields:
				profile_data[collection_field] = getattr(student, collection_field) or []
		# A verification applies to the specific card that was reviewed. A new
		# upload (or removal) must return the status to pending.
		if profile_data["college_id_card_url"] != student.college_id_card_url:
			student.college_id_verified = False
		for field_name, value in profile_data.items():
			setattr(student, field_name, value)
		student.skills = skills
		student.readiness_score = score
		student.readiness_status = readiness_status
		student.onboarding_complete = True
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=409, detail="A student profile already uses this roll number") from error
	session.refresh(student)
	return student


@router.post("", response_model=StudentResponse, status_code=201)
def create_student(
	payload: StudentCreate,
	session: Session = Depends(get_db),
) -> Student:
	profile = payload.model_dump()
	score, readiness_status = AIPlacementEngine().calculate_readiness(
		profile["cgpa"], profile["skills"], profile["mock_interview_score"]
	)
	profile["readiness_score"] = score
	profile["readiness_status"] = readiness_status
	student = Student(**profile)
	session.add(student)
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=409, detail="A student with this email or QR token already exists") from error
	session.refresh(student)
	return student


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
	student_id: int,
	payload: StudentUpdate,
	session: Session = Depends(get_db),
) -> Student:
	student = session.get(Student, student_id)
	if student is None:
		raise HTTPException(status_code=404, detail="Student not found")

	updates = payload.model_dump(exclude_unset=True)
	if (
		"college_id_card_url" in updates
		and updates["college_id_card_url"] != student.college_id_card_url
	):
		# Do not carry institutional verification over to a different card.
		student.college_id_verified = False
	for field_name, value in updates.items():
		setattr(student, field_name, value)
	score, readiness_status = AIPlacementEngine().calculate_readiness(
		student.cgpa, student.skills, student.mock_interview_score
	)
	student.readiness_score = score
	student.readiness_status = readiness_status
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=409, detail="A student with this email or QR token already exists") from error
	session.refresh(student)
	return student


@router.delete("/{student_id}", response_model=MessageResponse)
def delete_student(
	student_id: int,
	session: Session = Depends(get_db),
) -> MessageResponse:
	student = session.get(Student, student_id)
	if student is None:
		raise HTTPException(status_code=404, detail="Student not found")
	session.execute(delete(MatchRecord).where(MatchRecord.student_id == student_id))
	session.delete(student)
	session.commit()
	return MessageResponse(detail="Student deleted")


@router.post("/me/nudge", response_model=StudentNudgeResponse)
def create_student_nudge(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> StudentNudgeResponse:
	"""Recommend challenges for high-demand JD skills absent from the student's profile."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")

	demand_counts: Counter[str] = Counter()
	display_names: dict[str, str] = {}
	required_skill_rows = session.scalars(select(RecruiterJD.required_skills))
	for required_skills in required_skill_rows:
		for skill in _skill_parts(required_skills):
			key = _skill_key(skill)
			if key:
				demand_counts[key] += 1
				display_names.setdefault(key, skill)
	if not demand_counts and os.getenv("APP_ENV", "development").casefold() != "production":
		for skill in ("C++", "Algorithms", "SQL"):
			key = _skill_key(skill)
			demand_counts[key] = 1
			display_names[key] = skill

	student_skill_parts = _skill_parts(student.skills or "")
	student_skill_parts.extend(skill for skill in (student.verified_tech_stack or []) if skill not in student_skill_parts)
	student_skill_keys = {_skill_key(skill) for skill in student_skill_parts}
	missing_keys = sorted(
		(key for key in demand_counts if key not in student_skill_keys),
		key=lambda key: (-demand_counts[key], display_names[key].casefold()),
	)
	missing_skills = [display_names[key] for key in missing_keys]
	recommended_skills = missing_skills[:3]

	recommendations = [
		NudgeRecommendation(
			skill=skill,
			challenge=(
				f"Complete a focused {skill} learning sprint and build a small portfolio "
				"demo that applies it."
			),
			reward_xp=50,
			estimated_minutes=45,
		)
		for skill in recommended_skills
	]

	engine = AIPlacementEngine()
	profile = {
		"cgpa": student.cgpa,
		"skills": student_skill_parts,
		"required_skills": [display_names[key] for key in demand_counts],
		"mock_interview_score": student.mock_interview_score,
	}
	current_engine_score, _ = engine.calculate_readiness_score(profile)
	projected_profile = {
		**profile,
		"skills": student_skill_parts + recommended_skills,
	}
	projected_engine_score, _ = engine.calculate_readiness_score(projected_profile)
	projected_gain = max(projected_engine_score - current_engine_score, 0.0)

	current_score = min(max(float(student.readiness_score), 0.0), 100.0)
	forecast_score = round(min(current_score + projected_gain, 100.0), 2)
	score_bump = round(forecast_score - current_score, 2)
	message = (
		"Complete the recommended challenges to earn XP and improve your readiness score."
		if recommendations
		else "No recruiter requirements are currently published; no skill-gap recommendations are available."
	)

	return StudentNudgeResponse(
		student_id=student.id,
		current_readiness_score=current_score,
		forecast_readiness_score=forecast_score,
		readiness_score_bump=score_bump,
		missing_skills=missing_skills,
		recommendations=recommendations,
		message=message,
	)
