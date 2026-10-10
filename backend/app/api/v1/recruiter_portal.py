import json
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, joinedload

from backend.app.ai.ai_engine import AIPlacementEngine
from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import MatchRecord, RecruiterJD, User, Student, StudentApplication
from backend.app.schemas.recruiter import (
	RecruiterJD as RecruiterJDResponse,
	RecruiterJDCreate,
	RecruiterJDUpdate,
	ApplicantOverview,
	ApplicantStatusUpdate,
	ApplicantAIBrief,
	CandidatePitchResponse,
)
from backend.app.schemas.api import StudentDeepProfileResponse, DeepProfileMatchFactor

router = APIRouter(prefix="/recruiter-portal/jobs", tags=["recruiter portal jobs"])


def _load_applicant_context(application_id: int, session: Session):
	application = session.scalar(
		select(StudentApplication)
		.options(joinedload(StudentApplication.student))
		.where(StudentApplication.id == application_id)
	)
	if application is None:
		raise HTTPException(status_code=404, detail="Applicant not found")

	match = re.fullmatch(r"recruiter-jd-(\d+)", application.external_job_id)
	jd = session.get(RecruiterJD, int(match.group(1))) if match else None
	return application, application.student, jd


def _profile_skills(student: Student) -> list[str]:
	skills = [
		part.strip()
		for part in re.split(r"[,;|\n]", student.skills or "")
		if part.strip()
	]
	seen = {skill.casefold() for skill in skills}
	for skill in student.verified_tech_stack or []:
		if isinstance(skill, str) and skill.strip() and skill.casefold() not in seen:
			skills.append(skill.strip())
			seen.add(skill.casefold())
	return skills


def _entry_label(entry: dict, keys: tuple[str, ...]) -> str | None:
	for key in keys:
		value = entry.get(key)
		if isinstance(value, str) and value.strip():
			return value.strip()
	return None


def _applicant_intelligence(application, student: Student, jd: RecruiterJD | None):
	engine = AIPlacementEngine()
	required_skills = jd.required_skills if jd else ""
	profile_skills = _profile_skills(student)
	match = engine.match_and_explain(
		student.cgpa,
		profile_skills,
		jd.min_cgpa if jd else 0,
		required_skills,
	)
	if jd:
		existing_fit = engine.match_and_explain(
			student.cgpa,
			student.skills,
			jd.min_cgpa,
			jd.required_skills,
		)["fit_score"]
	else:
		existing_fit = 0
	match["fit_score"] = existing_fit
	strengths = []
	concerns = []
	minimum_cgpa = jd.min_cgpa if jd else None
	if minimum_cgpa is None:
		strengths.append(f"CGPA {student.cgpa:.2f}/10 is recorded in the candidate profile.")
	elif student.cgpa >= minimum_cgpa:
		strengths.append(
			f"CGPA {student.cgpa:.2f}/10 meets the role minimum of {minimum_cgpa:.2f}."
		)
	else:
		concerns.append(
			f"CGPA {student.cgpa:.2f}/10 is below the role minimum of {minimum_cgpa:.2f}."
		)

	if match["matched_skills"]:
		strengths.append(f"Role-required skills listed in the profile: {', '.join(match['matched_skills'])}.")
	if profile_skills and not match["matched_skills"]:
		strengths.append(f"Skills listed in the profile: {', '.join(profile_skills)}.")
	if jd and match["missing_skills"]:
		concerns.append(f"Required skills not found in the profile: {', '.join(match['missing_skills'])}.")
	elif jd and not match["missing_skills"] and not match["matched_skills"]:
		concerns.append("No structured required skills were available to assess.")
	elif not profile_skills:
		concerns.append("The candidate profile does not list skills, so technical alignment cannot be assessed.")

	verified = [
		skill.strip()
		for skill in student.verified_tech_stack or []
		if isinstance(skill, str) and skill.strip()
	]
	if verified:
		strengths.append(f"Verified tech stack: {', '.join(dict.fromkeys(verified))}.")

	for field_name, label in (
		("leetcode_rating", "LeetCode rating"),
		("hackerrank_rating", "HackerRank rating"),
		("coding_score", "Coding score"),
		("system_design_score", "System design score"),
		("aptitude_score", "Aptitude score"),
	):
		value = getattr(student, field_name)
		if value is not None:
			strengths.append(f"{label}: {value:g}.")

	projects = [
		entry for entry in (student.project_showcase or [])
		if isinstance(entry, dict)
	]
	project_labels = [
		_entry_label(entry, ("name", "title", "project_name"))
		for entry in projects
	]
	project_labels = [label for label in project_labels if label]
	if project_labels:
		strengths.append(f"Projects listed: {', '.join(project_labels[:4])}.")
	elif projects:
		strengths.append(f"{len(projects)} project(s) are listed in the profile.")

	internships = [
		entry for entry in (student.internship_experiences or [])
		if isinstance(entry, dict)
	]
	internship_labels = [
		_entry_label(entry, ("role", "title", "position", "company", "organization"))
		for entry in internships
	]
	internship_labels = [label for label in internship_labels if label]
	if internship_labels:
		strengths.append(f"Experience entries listed: {', '.join(internship_labels[:4])}.")
	elif internships:
		strengths.append(f"{len(internships)} experience entry/entries are listed in the profile.")

	if not jd:
		concerns.append(
			"The linked recruiter job description is unavailable; job eligibility and skill gaps cannot be verified."
		)
		alignment = "No recruiter job requirements are linked to this application."
	elif minimum_cgpa is not None and student.cgpa >= minimum_cgpa:
		alignment = (
			f"CGPA {student.cgpa:.2f}/10 meets the minimum of {minimum_cgpa:.2f}. "
		)
		if match["matched_skills"]:
			alignment += f"The profile lists {len(match['matched_skills'])} of "
			alignment += f"{len(match['matched_skills']) + len(match['missing_skills'])} required skill(s): "
			alignment += f"{', '.join(match['matched_skills'])}."
		elif match["missing_skills"]:
			alignment += "None of the structured required skills were found in the listed profile skills."
		else:
			alignment += "No structured required skills were available for comparison."
	else:
		alignment = (
			f"CGPA {student.cgpa:.2f}/10 is below the minimum of {minimum_cgpa:.2f}. "
			if minimum_cgpa is not None
			else "The job's structured eligibility requirements could not be verified. "
		)
		if match["matched_skills"]:
			alignment += f"Profile skills matching the role include {', '.join(match['matched_skills'])}."
		elif match["missing_skills"]:
			alignment += "The listed profile skills do not match the structured requirements."

	interview_focus = []
	if jd:
		if match["matched_skills"] or match["missing_skills"]:
			required_for_focus = match["matched_skills"] + match["missing_skills"]
			interview_focus.append(
				f"Discuss a role-relevant practical scenario involving {', '.join(required_for_focus[:2])}."
			)
		else:
			interview_focus.append(
				f"Discuss how the candidate's listed skills relate to the {application.job_title} role."
			)
		if profile_skills:
			interview_focus.append(
				f"Ask the candidate to explain practical depth in profile-listed skills: {', '.join(profile_skills[:2])}."
			)
		else:
			interview_focus.append(
				"Clarify technical skills or evidence not yet represented in the candidate profile."
			)
		if minimum_cgpa is not None:
			interview_focus.append(
				f"Clarify academic context for the recorded {student.cgpa:.2f}/10 CGPA against the role's {minimum_cgpa:.2f} minimum."
			)
		if project_labels:
			interview_focus.append(f"Invite a walkthrough of the listed project “{project_labels[0]}”.")
		elif projects:
			interview_focus.append("Ask the candidate to explain the scope and contribution in a listed project.")
		if internships:
			interview_focus.append("Clarify responsibilities and skills used in the listed experience.")
	else:
		interview_focus.append(
			"No recruiter job requirements are linked; keep discussion limited to skills and experience recorded in the candidate profile."
		)
	interview_focus = interview_focus[:5]
	if not interview_focus:
		interview_focus.append(
			"Tailored interview topics are unavailable until candidate profile and job requirement details are recorded."
		)

	if not jd:
		recommendation = "Review Manually — recruiter job requirements unavailable"
	elif match["fit_score"] >= 90:
		recommendation = "Strongly Shortlist"
	elif match["fit_score"] >= 75:
		recommendation = "Shortlist"
	elif match["fit_score"] >= 60:
		recommendation = "Review Manually"
	else:
		recommendation = "Do Not Prioritize"

	return {
		"strengths": strengths or ["No additional profile strengths are recorded."],
		"concerns": concerns or ["No specific eligibility or listed-skill gaps were identified."],
		"job_alignment": alignment,
		"interview_focus": interview_focus,
		"recommendation": recommendation,
		"match": match,
		"profile_skills": profile_skills,
		"project_labels": project_labels,
	}


def _stored_values(values: dict) -> dict:
	if "eligible_branches" in values and values["eligible_branches"] is not None:
		values["eligible_branches"] = json.dumps(values["eligible_branches"])
	return values


@router.get("", response_model=list[RecruiterJDResponse])
def list_jobs(session: Session = Depends(get_db), _user: User = Depends(require_roles("recruiter"))):
	return list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id.desc())))


@router.get("/applicants", response_model=list[ApplicantOverview])
def list_applicants(
	job_id: int | None = Query(default=None, ge=1),
	status: str | None = None,
	branch: str | None = None,
	search: str | None = None,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
):
	statement = (
		select(StudentApplication)
		.options(joinedload(StudentApplication.student))
		.order_by(StudentApplication.created_at.desc(), StudentApplication.id.desc())
	)
	if job_id is not None:
		statement = statement.where(
			StudentApplication.external_job_id == f"recruiter-jd-{job_id}"
		)
	if status:
		statement = statement.where(StudentApplication.status == status)
	if branch:
		statement = statement.where(StudentApplication.student.has(Student.branch.ilike(branch)))
	if search and search.strip():
		search_term = f"%{search.strip()}%"
		statement = statement.where(
			or_(
				StudentApplication.student.has(Student.name.ilike(search_term)),
				StudentApplication.job_title.ilike(search_term),
				StudentApplication.company_name.ilike(search_term),
			)
		)

	applications = list(session.scalars(statement))
	jd_ids = {
		int(match.group(1))
		for application in applications
		if (match := re.fullmatch(r"recruiter-jd-(\d+)", application.external_job_id))
	}
	jds = (
		{
			jd.id: jd
			for jd in session.scalars(select(RecruiterJD).where(RecruiterJD.id.in_(jd_ids)))
		}
		if jd_ids
		else {}
	)
	scorer = AIPlacementEngine()
	applicants = []
	for application in applications:
		student = application.student
		match = re.fullmatch(r"recruiter-jd-(\d+)", application.external_job_id)
		jd = jds.get(int(match.group(1))) if match else None
		fit_score = (
			scorer.match_and_explain(
				student.cgpa,
				student.skills,
				jd.min_cgpa,
				jd.required_skills,
			)["fit_score"]
			if jd
			else 0
		)
		applicants.append(
			ApplicantOverview(
				application_id=application.id,
				student_id=student.id,
				student_name=student.name,
				student_branch=student.branch,
				student_cgpa=student.cgpa,
				job_title=application.job_title,
				status=application.status,
				fit_score=fit_score,
				created_at=application.created_at,
			)
		)
	return sorted(applicants, key=lambda applicant: applicant.fit_score, reverse=True)


@router.get("/applicants/{application_id}/ai-brief", response_model=ApplicantAIBrief)
def get_applicant_ai_brief(
	application_id: int,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
):
	application, student, jd = _load_applicant_context(application_id, session)
	intelligence = _applicant_intelligence(application, student, jd)
	return ApplicantAIBrief(
		strengths=intelligence["strengths"],
		concerns=intelligence["concerns"],
		job_alignment=intelligence["job_alignment"],
		interview_focus=intelligence["interview_focus"],
		recommendation=intelligence["recommendation"],
	)


@router.post("/applicants/{application_id}/candidate-pitch", response_model=CandidatePitchResponse)
def generate_applicant_candidate_pitch(
	application_id: int,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
):
	application, student, jd = _load_applicant_context(application_id, session)
	intelligence = _applicant_intelligence(application, student, jd)
	if jd:
		pitch = AIPlacementEngine().generate_pitch(
			student.name,
			student.branch,
			student.cgpa,
			intelligence["match"]["fit_score"],
		)
	else:
		pitch = (
			f"{student.name} is a {student.branch} engineering candidate with a "
			f"{student.cgpa:.2f}/10 CGPA. This profile-based summary does not assess "
			"role fit because recruiter job requirements are unavailable."
		)
	relevant_skills = intelligence["match"]["matched_skills"] or intelligence["profile_skills"]
	lines = [
		f"Candidate: {student.name}",
		f"Target role: {application.job_title}" + (f" at {application.company_name}" if application.company_name else ""),
		pitch,
	]
	if relevant_skills:
		lines.append(f"Relevant technical skills listed: {', '.join(relevant_skills)}.")
	if intelligence["project_labels"]:
		lines.append(f"Projects listed: {', '.join(intelligence['project_labels'][:3])}.")
	experience_labels = [
		_entry_label(entry, ("role", "title", "position", "company", "organization"))
		for entry in (student.internship_experiences or [])
		if isinstance(entry, dict)
	]
	experience_labels = [label for label in experience_labels if label]
	if experience_labels:
		lines.append(f"Experience entries listed: {', '.join(experience_labels[:3])}.")
	accomplishment_labels = []
	for entry in student.accomplishments or []:
		if isinstance(entry, str) and entry.strip():
			accomplishment_labels.append(entry.strip())
		elif isinstance(entry, dict):
			label = _entry_label(entry, ("title", "name", "achievement"))
			if label:
				accomplishment_labels.append(label)
	if accomplishment_labels:
		lines.append(f"Achievements recorded: {', '.join(accomplishment_labels[:3])}.")
	recorded_scores = [
		f"{label} {getattr(student, field_name):g}"
		for field_name, label in (
			("leetcode_rating", "LeetCode rating"),
			("hackerrank_rating", "HackerRank rating"),
			("coding_score", "Coding score"),
			("system_design_score", "System design score"),
			("aptitude_score", "Aptitude score"),
		)
		if getattr(student, field_name) is not None
	]
	if recorded_scores:
		lines.append(f"Recorded scores: {', '.join(recorded_scores)}.")
	if not relevant_skills and not intelligence["project_labels"]:
		lines.append("Additional technical skills or project details were not available in the recorded profile.")
	if jd:
		lines.append(f"Role alignment: {intelligence['match']['reason']}")
	else:
		lines.append(
			"No recruiter job requirements are linked to this application; this pitch is based on the candidate profile rather than a specific recruiter job."
		)
	return CandidatePitchResponse(pitch="\n\n".join(lines))


@router.get("/{job_id}", response_model=RecruiterJDResponse)
def get_job(job_id: int, session: Session = Depends(get_db), _user: User = Depends(require_roles("recruiter"))):
	job = session.get(RecruiterJD, job_id)
	if job is None:
		raise HTTPException(status_code=404, detail="Job posting not found")
	return job


@router.post("", response_model=RecruiterJDResponse, status_code=201)
def create_job(payload: RecruiterJDCreate, session: Session = Depends(get_db), _user: User = Depends(require_roles("recruiter"))):
	values = payload.model_dump()
	if "job_category" not in payload.model_fields_set and re.search(r"intern", values["role_title"], re.IGNORECASE):
		values["job_category"] = "internship"
	job = RecruiterJD(**_stored_values(values))
	session.add(job)
	session.commit()
	session.refresh(job)
	return job


@router.put("/{job_id}", response_model=RecruiterJDResponse)
@router.patch("/{job_id}", response_model=RecruiterJDResponse)
def update_job(job_id: int, payload: RecruiterJDUpdate, session: Session = Depends(get_db), _user: User = Depends(require_roles("recruiter"))):
	job = session.get(RecruiterJD, job_id)
	if job is None:
		raise HTTPException(status_code=404, detail="Job posting not found")
	for key, value in _stored_values(payload.model_dump(exclude_unset=True)).items():
		setattr(job, key, value)
	session.commit()
	session.refresh(job)
	return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, session: Session = Depends(get_db), _user: User = Depends(require_roles("recruiter"))):
	job = session.get(RecruiterJD, job_id)
	if job is None:
		raise HTTPException(status_code=404, detail="Job posting not found")
	session.execute(delete(MatchRecord).where(MatchRecord.jd_id == job_id))
	session.delete(job)
	session.commit()
