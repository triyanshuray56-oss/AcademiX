"""Student-only analysis of applied opportunities after a finalized interview assessment."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import RecruiterJD, Student, StudentApplication, User
from backend.app.services.job_aggregator import aggregate_opportunities

router = APIRouter(prefix="/applications", tags=["application-analysis"])


def _skills(value: object) -> set[str]:
	if isinstance(value, list):
		parts = [str(item) for item in value]
	else:
		parts = re.split(r"[,;|\n]", str(value or ""))
	return {re.sub(r"\s+", " ", part).strip().casefold() for part in parts if str(part).strip()}


def _number_requirement(description: str, pattern: str) -> float | None:
	match = re.search(pattern, description, re.IGNORECASE)
	if not match:
		return None
	try:
		return float(match.group(1))
	except (TypeError, ValueError):
		return None


@router.get("/analysis")
async def get_application_analysis(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> dict:
	"""Compare the signed-in student's applied roles with their current profile.

	Analysis is withheld until the persisted interview assessment has both speech
	and system-design values, which are written together by the student assessment
	flow when the interview result is saved.
	"""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		return {
			"status": "profile_required", "finalized_interview_result": False,
			"results": [], "message": "Complete your student profile to view application analysis.",
		}
	interview_finalized = student.system_design_score is not None and student.ai_speech_score is not None
	if not interview_finalized:
		return {
			"status": "awaiting_finalized_results", "finalized_interview_result": False,
			"results": [],
			"message": "No finalized application results available for analysis yet. Save a completed mock interview assessment first.",
		}

	applications = list(session.scalars(
		select(StudentApplication)
		.where(StudentApplication.student_id == student.id)
		.order_by(StudentApplication.created_at.desc(), StudentApplication.id.desc())
	))
	if not applications:
		return {
			"status": "ready", "finalized_interview_result": True, "results": [],
			"message": "No job applications are linked to your profile yet.",
		}

	listings, _ = await aggregate_opportunities(count=50)
	listing_by_id = {str(item.get("id")): item for item in listings}
	recruiter_jds = {item.id: item for item in session.scalars(select(RecruiterJD))}
	student_skills = _skills(student.skills) | _skills(student.verified_tech_stack)
	projects = student.project_showcase or []
	results = []
	for application in applications:
		job = listing_by_id.get(application.external_job_id)
		jd = None
		match = re.fullmatch(r"recruiter-jd-(\d+)", application.external_job_id)
		if match:
			jd = recruiter_jds.get(int(match.group(1)))
		job_description = str(job.get("description") if job else "")
		required_skills = _skills(job.get("tags", []) if job else (jd.required_skills if jd else []))
		if jd and not required_skills:
			required_skills = _skills(jd.required_skills)
		matched_skills = sorted(student_skills & required_skills)
		missing_skills = sorted(required_skills - student_skills)
		skill_score = round(100 * len(matched_skills) / len(required_skills)) if required_skills else None
		minimum_cgpa = jd.min_cgpa if jd else _number_requirement(job_description, r"(?:minimum|min\.?|required)\s*cgpa\s*[:=]?\s*(\d+(?:\.\d+)?)")
		cgpa_meets = None if minimum_cgpa is None else float(student.cgpa) >= float(minimum_cgpa)
		role_available = bool(job or jd)
		if not role_available:
			recommendation = "The original listing is no longer in the active feed, so its requirements could not be rechecked. Review the employer listing directly."
		elif missing_skills:
			recommendation = f"Add evidence for {', '.join(missing_skills[:3])} in a project or portfolio entry to improve your match."
		elif cgpa_meets is False:
			recommendation = f"This role lists a minimum CGPA of {minimum_cgpa:g}; strengthen other application evidence and check the employer's eligibility rules."
		elif not required_skills:
			recommendation = "No structured skill requirements were available; review the employer description and tailor your application to it."
		else:
			recommendation = "Your listed skills align with this role. Use your interview feedback to strengthen examples tied to the job requirements."
		results.append({
			"application_id": application.id,
			"job_id": application.external_job_id,
			"title": application.job_title,
			"company": application.company_name,
			"application_url": application.job_url,
			"applied_at": application.created_at,
			"application_status": application.status,
			"requirements_available": role_available,
			"job_type": (job or {}).get("job_type"),
			"skill_match_percent": skill_score,
			"matched_skills": matched_skills,
			"missing_skills": missing_skills,
			"cgpa": float(student.cgpa),
			"minimum_cgpa": minimum_cgpa,
			"cgpa_meets_requirement": cgpa_meets,
			"project_count": len(projects),
			"finalized_interview_score": float(student.mock_interview_score or 0),
			"finalized_system_design_score": float(student.system_design_score),
			"finalized_communication_score": float(student.ai_speech_score),
			"recommendation": recommendation,
		})
	return {
		"status": "ready", "finalized_interview_result": True,
		"finalized_at": None,
		"results": results,
		"message": "Analysis uses your current profile and applied roles. Requirements are refreshed from the active listings where available.",
	}
