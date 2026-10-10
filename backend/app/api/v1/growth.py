import re
import os
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import RecruiterJD, Student, StudentGrowthSnapshot, User
from backend.app.models.growth import capture_daily_snapshot, profile_completeness
from backend.app.api.v1.jobs import get_active_job_feed
from backend.app.services.jobicy_service import fetch_jobicy_jobs

router = APIRouter(prefix="/growth", tags=["growth"])

COMPATIBILITY_SKILLS = (
	"Python", "Java", "JavaScript", "TypeScript", "React", "Angular", "Vue", "Node.js",
	"FastAPI", "Django", "Flask", "SQL", "PostgreSQL", "MongoDB", "AWS", "Azure", "GCP",
	"Docker", "Kubernetes", "DevOps", "CI/CD", "Machine Learning", "Artificial Intelligence",
	"Data Science", "Pandas", "TensorFlow", "PyTorch", "Data Structures", "Algorithms",
	"System Design", "C++", "C#", "Go", "Rust", "HTML", "CSS", "Git", "Linux",
)

COMPATIBILITY_WEIGHTS = {
	"skills": 0.35,
	"cgpa": 0.20,
	"leetcode": 0.20,
	"projects_and_experience": 0.10,
	"profile_completeness": 0.05,
	"backlogs": 0.05,
	"branch_fit": 0.05,
}

DEFAULT_CGPA_REQUIREMENT = 6.0
DEFAULT_LEETCODE_REQUIREMENT = 1200.0


class GrowthAnalyticsResponse(BaseModel):
	student_id: int
	current: dict[str, float | int | None]
	history: list[dict[str, float | int | str | None]]
	deltas: dict[str, float | int | None]
	permutations: list[dict]
	risk: dict
	delta_feed: list[dict]
	data_notes: list[str]


class JobCompatibilityResponse(BaseModel):
	student_id: int
	openings: list[dict]
	count: int
	source: str
	generated_at: str
	note: str
	weights: dict[str, float]


def _track_projection(name: str, targets: tuple[str, ...], student: Student, current_completeness: float) -> dict:
	student_skills = [skill.casefold() for skill in (student.verified_tech_stack or []) if skill.strip()]
	student_skills += [skill.strip().casefold() for skill in (student.skills or "").split(",")]
	coverage = sum(any(target.casefold() in skill or skill in target.casefold() for skill in student_skills) for target in targets) / len(targets)
	readiness = min(100.0, max(0.0, float(student.readiness_score or 0)))
	cgpa_signal = min(100.0, max(0.0, float(student.cgpa or 0) * 10))
	matching_score = round(min(100.0, 0.55 * readiness + 0.20 * cgpa_signal + 0.25 * coverage * 100), 1)
	weekly_gain = max(0.6, 1.2 + (1 - coverage) * 1.2 + (1 - current_completeness / 100) * 0.5)
	curves = [
		{"week": week, "readiness": round(min(100.0, readiness + weekly_gain * week), 1)}
		for week in (0, 2, 4, 8, 12)
	]
	weeks_to_ready = 0 if matching_score >= 75 else round((75 - matching_score) / weekly_gain, 1)
	return {
		"name": name,
		"skill_coverage": round(coverage * 100, 1),
		"matching_score": matching_score,
		"estimated_weeks_to_ready": weeks_to_ready,
		"readiness_curve": curves,
		"practice_assumption": "Estimate assumes about 4 hours of focused practice each week.",
	}


def _skill_key(value: str) -> str:
	key = re.sub(r"[^a-z0-9+#]+", " ", value.casefold()).strip()
	aliases = {"react js": "react", "reactjs": "react", "node": "node js", "nodejs": "node js", "js": "javascript", "ts": "typescript", "ml": "machine learning", "ai": "artificial intelligence"}
	return aliases.get(key, key)


def _minimum_requirement(text: str, pattern: str, default: float) -> tuple[float, bool]:
	match = re.search(pattern, text, flags=re.IGNORECASE)
	return (float(match.group(1)), True) if match else (default, False)


def _portfolio_skill_labels(entries: list[dict] | None) -> list[str]:
	labels: list[str] = []
	for entry in entries or []:
		if not isinstance(entry, dict):
			continue
		for key in ("tech_stack", "technologies", "tech_tags", "tags", "skills"):
			values = entry.get(key) or []
			if isinstance(values, str):
				labels.extend(part.strip() for part in re.split(r"[,;|]", values) if part.strip())
			elif isinstance(values, list):
				labels.extend(str(value).strip() for value in values if str(value).strip())
	return labels


def _opening_compatibility(job: dict, student: Student, completeness: float) -> dict:
	tags = job.get("tags") or []
	if isinstance(tags, str):
		tags = [tag.strip() for tag in re.split(r"[,;|]", tags) if tag.strip()]
	job_text = " ".join((
		str(job.get("title") or ""),
		str(job.get("description") or ""),
		" ".join(str(tag) for tag in tags),
	))
	job_text_lower = job_text.casefold()
	inferred_requirements = [
		skill for skill in COMPATIBILITY_SKILLS
		if re.search(rf"(?<![a-z0-9]){re.escape(skill.casefold())}(?![a-z0-9])", job_text_lower)
	]
	student_skill_labels = list(student.verified_tech_stack or [])
	student_skill_labels.extend(part.strip() for part in (student.skills or "").split(",") if part.strip())
	student_skill_labels.extend(_portfolio_skill_labels(student.project_showcase or []))
	student_skill_labels.extend(_portfolio_skill_labels(student.internship_experiences or []))
	student_skill_map = {_skill_key(skill): skill for skill in student_skill_labels if skill.strip()}
	matched = [skill for skill in inferred_requirements if _skill_key(skill) in student_skill_map]
	missing = [skill for skill in inferred_requirements if _skill_key(skill) not in student_skill_map]
	skill_score = (len(matched) / len(inferred_requirements) * 100) if inferred_requirements else 100.0
	cgpa_requirement, cgpa_requirement_explicit = _minimum_requirement(
		job_text_lower, r"\bcgpa\b[^\d]{0,24}(\d(?:\.\d{1,2})?)", DEFAULT_CGPA_REQUIREMENT
	)
	cgpa_value = float(student.cgpa or 0)
	cgpa_score = min(100.0, max(0.0, cgpa_value / cgpa_requirement * 100)) if cgpa_requirement else 0.0
	leetcode_requirement, leetcode_requirement_explicit = _minimum_requirement(
		job_text_lower, r"\b(?:leetcode|coding|problem[- ]solving)\b[^\d]{0,32}(\d{3,5})", DEFAULT_LEETCODE_REQUIREMENT
	)
	leetcode_value = float(student.leetcode_rating or 0)
	leetcode_score = min(100.0, max(0.0, leetcode_value / leetcode_requirement * 100)) if leetcode_requirement else 0.0
	project_count = len(student.project_showcase or [])
	experience_count = len(student.internship_experiences or [])
	project_score = min(100.0, project_count * 50.0)
	experience_score = min(100.0, experience_count * 50.0)
	practical_score = (project_score + experience_score) / 2
	profile_score = min(100.0, max(0.0, completeness))
	backlogs = int(student.active_backlogs or 0)
	backlog_score = max(0.0, 100.0 - backlogs * 50.0)
	branch_values = job.get("required_branches") or []
	if isinstance(branch_values, str):
		branch_values = [part.strip() for part in re.split(r"[,;|]", branch_values) if part.strip()]
	if not branch_values:
		context_match = re.search(
			r"(?:branch(?:es)?|major|degree|graduates?\s+(?:in|from))\s*[:\-]?\s*([^.;\n]{1,120})",
			job_text,
			re.IGNORECASE,
		)
		if context_match:
			context = context_match.group(1)
			known_branches = (
				"Computer Science and Engineering", "Computer Science", "Information Technology",
				"Electronics and Telecommunication", "Electronics and Communication",
				"Electrical Engineering", "Mechanical Engineering", "Civil Engineering",
				"CSE", "ECE", "ETC", "IT", "Electrical", "Mechanical", "Civil",
			)
			branch_values = [branch for branch in known_branches if re.search(rf"\b{re.escape(branch)}\b", context, re.IGNORECASE)]
	student_branch = _skill_key(student.branch or "")
	branch_aliases = {
		"cse": {"cse", "computer science", "computer science and engineering", "cs"},
		"it": {"it", "information technology"},
		"etc": {"etc", "electronics and telecommunication", "electronics and telecommunications"},
		"ece": {"ece", "electronics and communication", "electronics and communications"},
		"ee": {"ee", "electrical engineering", "electrical"},
		"me": {"me", "mechanical engineering", "mechanical"},
		"civil": {"civil", "civil engineering"},
	}
	student_branch_group = next((group for group, aliases in branch_aliases.items() if student_branch in {_skill_key(alias) for alias in aliases}), student_branch)
	required_branch_groups = {
		next((group for group, aliases in branch_aliases.items() if _skill_key(branch) in {_skill_key(alias) for alias in aliases}), _skill_key(branch))
		for branch in branch_values
	}
	branch_score = 100.0 if not required_branch_groups or student_branch_group in required_branch_groups else 0.0
	score = round(
		skill_score * COMPATIBILITY_WEIGHTS["skills"]
		+ cgpa_score * COMPATIBILITY_WEIGHTS["cgpa"]
		+ leetcode_score * COMPATIBILITY_WEIGHTS["leetcode"]
		+ practical_score * COMPATIBILITY_WEIGHTS["projects_and_experience"]
		+ profile_score * COMPATIBILITY_WEIGHTS["profile_completeness"]
		+ backlog_score * COMPATIBILITY_WEIGHTS["backlogs"]
		+ branch_score * COMPATIBILITY_WEIGHTS["branch_fit"],
		1,
	)
	fit_tier = "Top Match" if score >= 75 else "Moderate Fit" if score >= 55 else "Low Match / High Skill Gap"
	role_type_values = job.get("job_type") or []
	if isinstance(role_type_values, str):
		role_type_values = [role_type_values]
	type_text = " ".join(str(value).casefold() for value in role_type_values)
	if "intern" in type_text:
		role_type = "Internship"
	elif "full-time" in type_text or "full time" in type_text:
		role_type = "Full-Time Job"
	else:
		role_type = "Job"
	recommendations: list[str] = []
	if missing:
		recommendations.append(f"Add a practical project demonstrating {', '.join(missing[:3])} to improve this role's skill match.")
	if cgpa_score >= 100:
		threshold_label = "requirement" if cgpa_requirement_explicit else "comparison threshold (the listing does not state a cutoff)"
		recommendations.append(f"Your CGPA meets the {cgpa_requirement:g} {threshold_label}; highlight it near the top of your resume.")
	else:
		threshold_label = "stated requirement" if cgpa_requirement_explicit else "assumed comparison threshold (the listing does not state a cutoff)"
		recommendations.append(f"Your CGPA is below the {cgpa_requirement:g} {threshold_label}; strengthen the application with project evidence and confirm employer flexibility.")
	if leetcode_score < 100:
		leetcode_label = "stated threshold" if leetcode_requirement_explicit else "assumed comparison threshold (the listing does not state a cutoff)"
		if leetcode_value <= 0:
			recommendations.append(f"Add your LeetCode rating and practice toward the {leetcode_requirement:g} {leetcode_label}.")
		else:
			recommendations.append(f"LeetCode rating is below the {leetcode_requirement:g} {leetcode_label}; complete timed problem sets to close the gap.")
	if practical_score < 100:
		recommendations.append(f"Add practical evidence: {max(0, 2 - project_count)} more project(s) and {max(0, 2 - experience_count)} more experience entry/entries improve this signal.")
	if completeness < 75:
		recommendations.append("Complete missing profile sections and upload your resume to strengthen recruiter review.")
	if backlogs:
		recommendations.append(f"You have {backlogs} active backlog(s); confirm this role's eligibility with the placement cell before applying.")
	if required_branch_groups and branch_score == 0:
		recommendations.append(f"This listing specifies {', '.join(branch_values)}; your {student.branch or 'current'} branch may not meet that requirement.")
	elif required_branch_groups:
		recommendations.append(f"Your {student.branch} branch matches the listed branch eligibility.")
	if not recommendations:
		recommendations.append("Your profile meets the estimated role signals; tailor your resume to the matched skills and apply.")
	return {
		"id": str(job.get("id", "")),
		"title": str(job.get("title") or "Remote opportunity"),
		"company": str(job.get("company") or "Company"),
		"description": str(job.get("description") or ""),
		"logo": job.get("logo"),
		"url": str(job.get("url") or "https://jobicy.com/jobs"),
		"location": str(job.get("location") or "Remote"),
		"required_branches": branch_values,
		"geo_requirements": job.get("geo_requirements") or job.get("location") or "Remote",
		"salary": job.get("salary"),
		"annual_salary_min": job.get("annual_salary_min"),
		"annual_salary_max": job.get("annual_salary_max"),
		"salary_currency": job.get("salary_currency"),
		"published_at": job.get("published_at"),
		"role_type": role_type,
		"tags": tags,
		"compatibility_score": score,
		"fit_tier": fit_tier,
		"rank_recommendation": recommendations[0],
		"matched_skills": matched,
		"missing_skills": missing,
		"inferred_requirements": inferred_requirements,
		"requirements_inferred": True,
		"score_breakdown": {
			"skill_fit": round(skill_score, 1),
			"cgpa_signal": round(cgpa_score, 1),
			"cgpa_requirement": cgpa_requirement,
			"cgpa_requirement_explicit": cgpa_requirement_explicit,
			"leetcode_signal": round(leetcode_score, 1),
			"leetcode_requirement": leetcode_requirement,
			"leetcode_requirement_explicit": leetcode_requirement_explicit,
			"project_signal": round(project_score, 1),
			"experience_signal": round(experience_score, 1),
			"practical_experience_signal": round(practical_score, 1),
			"profile_completeness": round(profile_score, 1),
			"backlog_signal": round(backlog_score, 1),
			"branch_signal": round(branch_score, 1),
			"branch_requirement_explicit": bool(required_branch_groups),
		},
		"recommendations": recommendations,
	}


@router.get("/job-compatibility", response_model=JobCompatibilityResponse)
async def get_job_compatibility(
	request: Request,
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> JobCompatibilityResponse:
	"""Rank all available Jobicy and CampusLink recruiter listings for this student."""
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")
	database_jobs, database_source = get_active_job_feed(session, request)
	live_jobs = await fetch_jobicy_jobs(count=50)
	jobs = [*database_jobs, *live_jobs]
	source = "Jobicy live feed + CampusLink recruiter database" if live_jobs else database_source
	completeness = profile_completeness(student)
	openings = [_opening_compatibility(job, student, completeness) for job in jobs]
	openings.sort(key=lambda opening: (-opening["compatibility_score"], opening["id"].casefold()))
	return JobCompatibilityResponse(
		student_id=student.id,
		openings=openings,
		count=len(openings),
		source=source,
		generated_at=date.today().isoformat(),
		note=("Rankings include the complete Jobicy feed response and CampusLink recruiter listings. " if live_jobs else "Jobicy is currently unavailable; rankings use the available CampusLink feed. ") + "Scores include skill overlap, CGPA, LeetCode, practical experience, profile completeness, backlog load, and stated branch eligibility. Branch fit is neutral when a listing gives no branch requirement.",
		weights=COMPATIBILITY_WEIGHTS,
	)


@router.get("/me", response_model=GrowthAnalyticsResponse)
def get_my_growth_analytics(
	session: Session = Depends(get_db),
	current_user: User = Depends(require_roles("student")),
) -> GrowthAnalyticsResponse:
	student = session.scalar(select(Student).where(Student.email == current_user.email))
	if student is None:
		raise HTTPException(status_code=404, detail="Student profile not found; onboarding required")

	# A daily snapshot is also captured by GET /students/me after sign-in.
	capture_daily_snapshot(session, student)
	snapshots = list(session.scalars(
		select(StudentGrowthSnapshot)
		.where(StudentGrowthSnapshot.student_id == student.id)
	.order_by(StudentGrowthSnapshot.date, StudentGrowthSnapshot.id)
	))
	completeness = profile_completeness(student)
	readiness = round(float(student.readiness_score or 0), 1)
	today = date.today()
	previous = next((item for item in reversed(snapshots) if item.date < today), None)
	week_baseline = next((item for item in reversed(snapshots) if (today - item.date).days >= 7), None)
	previous_gap_days = (today - previous.date).days if previous else None
	daily_delta = round(readiness - previous.readiness_score, 1) if previous and previous_gap_days == 1 else None
	weekly_delta = round(readiness - week_baseline.readiness_score, 1) if week_baseline else None
	daily_velocity = round((readiness - previous.readiness_score) / previous_gap_days, 2) if previous and previous_gap_days else None
	week_gap_days = (today - week_baseline.date).days if week_baseline else None
	weekly_velocity = round((readiness - week_baseline.readiness_score) * 7 / week_gap_days, 2) if week_baseline and week_gap_days else None

	active_backlogs = int(student.active_backlogs or 0)
	interview_score = float(student.mock_interview_score or 0)
	backlog_risk = min(100.0, active_backlogs * 35.0)
	readiness_gap = max(0.0, 100.0 - readiness)
	interview_gap = max(0.0, 100.0 - interview_score)
	incomplete_profile = 100.0 - completeness
	risk_index = round(0.25 * incomplete_profile + 0.30 * backlog_risk + 0.25 * interview_gap + 0.20 * readiness_gap, 1)
	risk_level = "High" if risk_index >= 70 else "Moderate" if risk_index >= 40 else "Lower"

	if len(snapshots) < 2:
		decay_factor = None
		stagnant_days = None
	else:
		last_improvement = next(
			(
				snapshots[index].date
				for index in range(len(snapshots) - 1, 0, -1)
				if snapshots[index].readiness_score > snapshots[index - 1].readiness_score
			),
		snapshots[0].date,
		)
		stagnant_days = max(0, (today - last_improvement).days)
		last_step_delta = snapshots[-1].readiness_score - snapshots[-2].readiness_score
		decay_factor = round(min(100.0, stagnant_days * 1.5 + max(0.0, -last_step_delta) * 2), 1)

	recruiter_roles = list(session.scalars(select(RecruiterJD).order_by(RecruiterJD.id)))
	permutations = []
	for jd in recruiter_roles:
		targets = tuple(part.strip() for part in re.split(r"[,;|]", jd.required_skills or "") if part.strip())
		if targets:
			permutations.append(_track_projection(f"{jd.company_name} · {jd.role_title}", targets, student, completeness))
	if not permutations and not recruiter_roles and os.getenv("APP_ENV", "development").casefold() != "production":
		permutations = [
			_track_projection("Full-Stack Engineering", ("React", "Node.js", "SQL"), student, completeness),
			_track_projection("Data & AI", ("Python", "SQL", "Machine Learning"), student, completeness),
			_track_projection("Core SDE", ("Data Structures", "Algorithms", "Java"), student, completeness),
		]
	history = [
		{
			"date": item.date.isoformat(),
			"readiness_score": item.readiness_score,
			"leetcode_rating": item.leetcode_rating,
			"cgpa": item.cgpa,
			"project_count": item.project_count,
			"interview_score": item.interview_score,
			"profile_completeness": item.profile_completeness,
		}
		for item in snapshots
	]
	is_demo_growth = len(snapshots) < 2 and os.getenv("APP_ENV", "development").casefold() != "production"
	if is_demo_growth:
		history = [
			{
				"date": (today - timedelta(days=7 - index)).isoformat(),
				"readiness_score": round(max(0.0, readiness - (7 - index) * 1.15), 1),
				"leetcode_rating": max(0.0, float(student.leetcode_rating or 0) - (7 - index) * 12),
				"cgpa": max(0.0, float(student.cgpa or 0) - (7 - index) * 0.01),
				"project_count": max(0, len(student.project_showcase or []) - (1 if index < 3 else 0)),
				"interview_score": max(0.0, interview_score - (7 - index) * 1.5),
				"profile_completeness": round(max(0.0, completeness - (7 - index) * 1.2), 1),
			}
			for index in range(8)
		]
	delta_feed = []
	if previous:
		for label, field, current_value in (
			("Readiness", "readiness_score", readiness),
			("LeetCode rating", "leetcode_rating", student.leetcode_rating),
			("CGPA", "cgpa", student.cgpa),
			("Projects", "project_count", len(student.project_showcase or [])),
			("Interview score", "interview_score", interview_score),
			("Profile completeness", "profile_completeness", completeness),
		):
			prior_value = getattr(previous, field)
			if current_value is not None and prior_value is not None and float(current_value) != float(prior_value):
				delta_feed.append({"metric": label, "change": round(float(current_value) - float(prior_value), 1), "from": prior_value, "to": current_value})
	if not delta_feed:
		delta_feed.append({"metric": "Daily snapshot", "change": None, "detail": "No profile metric changes since the prior daily snapshot." if previous else "Today's baseline has been recorded; changes will appear on a later daily snapshot."})
	if is_demo_growth:
		delta_feed = [
			{"metric": "Readiness", "change": 1.2, "detail": "Illustrative daily trend for the development preview."},
			{"metric": "LeetCode rating", "change": 12, "detail": "Illustrative weekly practice progress."},
			{"metric": "Profile completeness", "change": 4.0, "detail": "Illustrative impact from recent profile updates."},
		]

	return GrowthAnalyticsResponse(
		student_id=student.id,
		current={
			"readiness_score": readiness,
			"leetcode_rating": student.leetcode_rating,
			"cgpa": student.cgpa,
			"project_count": len(student.project_showcase or []),
			"interview_score": interview_score,
			"profile_completeness": completeness,
		},
		history=history,
		deltas={"day_over_day": 1.2 if is_demo_growth else daily_delta, "week_over_week": 8.1 if is_demo_growth else weekly_delta, "readiness_points_per_day": 1.2 if is_demo_growth else daily_velocity, "readiness_points_per_week": 8.1 if is_demo_growth else weekly_velocity, "days_since_previous_snapshot": previous_gap_days},
		permutations=permutations,
		risk={
			"rejection_risk_index": risk_index,
			"risk_level": risk_level,
			"skill_decay_factor": decay_factor,
			"stagnant_days": stagnant_days,
			"components": {
				"profile_gaps": round(incomplete_profile, 1),
				"active_backlog_load": round(backlog_risk, 1),
				"interview_score_gap": round(interview_gap, 1),
				"readiness_gap": round(readiness_gap, 1),
			},
		},
		delta_feed=delta_feed,
		data_notes=[
			"Career path matching, time-to-readiness, rejection risk, and skill decay are profile-based heuristics, not validated placement predictions.",
			"Company-level historical benchmarks are not stored in this system and are not included in these estimates.",
			"Daily history begins with the first authenticated profile load after this feature is deployed.",
			*( ["Development-only sample career tracks are shown when no recruiter roles exist."] if not recruiter_roles and os.getenv("APP_ENV", "development").casefold() != "production" else [] ),
			*( ["The short readiness trend and delta feed are illustrative development data until more daily snapshots are recorded."] if is_demo_growth else [] ),
		],
	)
