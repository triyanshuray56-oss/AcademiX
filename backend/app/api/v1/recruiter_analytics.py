import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from backend.app.ai.ai_engine import AIPlacementEngine
from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import (
	MatchRecord,
	RecruiterInterview,
	RecruiterJD,
	RecruiterOffer,
	StudentApplication,
	User,
)
from backend.app.schemas.recruiter_analytics import (
	CandidateQuality,
	FunnelStage,
	RecruiterAnalyticsResponse,
	RecruiterJobPerformance,
	RecruitmentSpeed,
	SkillInsight,
)

router = APIRouter(prefix="/recruiter-portal/analytics", tags=["recruiter analytics"])
RECRUITER_JOB_ID = re.compile(r"recruiter-jd-(\d+)")
SHORTLIST_ACTIONS = {"Shortlisted", "Interview Scheduled", "Offer Extended"}
INTERVIEWED_STATUSES = {"Completed", "In Progress"}
COUNTED_INTERVIEW_STATUSES = {"Scheduled", "In Progress", "Completed"}


def _percent(numerator: int, denominator: int) -> float:
	return round(numerator / denominator * 100, 2) if denominator else 0.0


def _utc_naive(value: datetime) -> datetime:
	if value.tzinfo is None:
		return value
	return value.astimezone(timezone.utc).replace(tzinfo=None)


def _average_days(deltas: list[float]) -> float | None:
	return round(sum(deltas) / len(deltas), 2) if deltas else None


def _skill_insight_rows(
	requested_by_skill: Counter[str],
	candidate_by_skill: Counter[str],
	gaps_by_skill: Counter[str],
) -> list[SkillInsight]:
	return [
		SkillInsight(
			skill=skill,
			job_count=job_count,
			candidate_count=candidate_by_skill[skill],
			gap_count=gaps_by_skill[skill],
			coverage_rate=_percent(candidate_by_skill[skill], candidate_by_skill[skill] + gaps_by_skill[skill]),
		)
		for skill, job_count in requested_by_skill.items()
	]


@router.get("", response_model=RecruiterAnalyticsResponse)
def get_recruiter_analytics(
	job_id: int | None = Query(default=None, ge=1),
	category: str | None = Query(default=None, pattern="^(job|internship)$"),
	date_from: date | None = None,
	date_to: date | None = None,
	session: Session = Depends(get_db),
	_user: User = Depends(require_roles("recruiter")),
) -> RecruiterAnalyticsResponse:
	if date_from and date_to and date_from > date_to:
		raise HTTPException(status_code=422, detail="date_from must not be after date_to")

	jd_statement = select(RecruiterJD)
	if job_id is not None:
		jd_statement = jd_statement.where(RecruiterJD.id == job_id)
	if category is not None:
		jd_statement = jd_statement.where(RecruiterJD.job_category == category)
	jobs = list(session.scalars(jd_statement.order_by(RecruiterJD.role_title, RecruiterJD.id)))
	job_by_id = {jd.id: jd for jd in jobs}
	if job_id is not None and not jobs:
		raise HTTPException(status_code=404, detail="Recruiter job not found")

	application_statement = (
		select(StudentApplication)
		.options(joinedload(StudentApplication.student))
		.where(StudentApplication.external_job_id.in_([f"recruiter-jd-{jd_id}" for jd_id in job_by_id]))
	)
	if date_from is not None:
		application_statement = application_statement.where(
			func.date(StudentApplication.created_at) >= date_from.isoformat()
		)
	if date_to is not None:
		application_statement = application_statement.where(
			func.date(StudentApplication.created_at) <= date_to.isoformat()
		)
	applications = list(session.scalars(application_statement)) if job_by_id else []
	application_job: dict[int, int] = {}
	applications_by_job: dict[int, list[StudentApplication]] = defaultdict(list)
	for application in applications:
		match = RECRUITER_JOB_ID.fullmatch(application.external_job_id)
		if match is None:
			continue
		recruiter_jd_id = int(match.group(1))
		if recruiter_jd_id not in job_by_id:
			continue
		application_job[application.id] = recruiter_jd_id
		applications_by_job[recruiter_jd_id].append(application)

	application_ids = list(application_job)
	pairs = {(application.student_id, application_job[application.id]) for application in applications if application.id in application_job}
	student_ids = {student_id for student_id, _ in pairs}
	match_records = (
		list(
			session.scalars(
				select(MatchRecord).where(
					MatchRecord.student_id.in_(student_ids),
					MatchRecord.jd_id.in_(job_by_id),
				)
			)
		)
		if student_ids and job_by_id
		else []
	)
	match_by_pair = {
		(record.student_id, record.jd_id): record
		for record in match_records
		if (record.student_id, record.jd_id) in pairs
	}

	interviews = (
		list(
			session.scalars(
				select(RecruiterInterview)
				.where(RecruiterInterview.application_id.in_(application_ids))
				.order_by(RecruiterInterview.created_at, RecruiterInterview.id)
			)
		)
		if application_ids
		else []
	)
	interviews_by_application: dict[int, list[RecruiterInterview]] = defaultdict(list)
	for interview in interviews:
		interviews_by_application[interview.application_id].append(interview)

	offers = (
		list(
			session.scalars(
				select(RecruiterOffer).where(RecruiterOffer.application_id.in_(application_ids))
			)
		)
		if application_ids
		else []
	)
	offers_by_application = {offer.application_id: offer for offer in offers}

	scorer = AIPlacementEngine()
	fit_by_application: dict[int, float] = {}
	requested_by_skill: Counter[str] = Counter()
	candidate_by_skill: Counter[str] = Counter()
	gaps_by_skill: Counter[str] = Counter()
	for jd in jobs:
		requirement_match = scorer.match_and_explain(10.0, "", 0.0, jd.required_skills)
		skill_names = list(dict.fromkeys(requirement_match["missing_skills"]))
		requested_by_skill.update(skill_names)

	for application in applications:
		jd_id = application_job.get(application.id)
		jd = job_by_id.get(jd_id) if jd_id is not None else None
		if jd is None:
			continue
		result = scorer.match_and_explain(
			application.student.cgpa,
			application.student.skills,
			jd.min_cgpa,
			jd.required_skills,
		)
		fit_by_application[application.id] = float(result["fit_score"])
		candidate_by_skill.update(result["matched_skills"])
		gaps_by_skill.update(result["missing_skills"])

	shortlisted_ids: set[int] = set()
	offer_ids: set[int] = set()
	accepted_ids: set[int] = set()
	placement_ids: set[int] = set()
	for application in applications:
		record = match_by_pair.get((application.student_id, application_job[application.id]))
		if application.status.strip().casefold() in {"shortlisted", "interview scheduled", "selected"}:
			shortlisted_ids.add(application.id)
		if record and record.recruiter_action_status in SHORTLIST_ACTIONS:
			shortlisted_ids.add(application.id)
			if record.recruiter_action_status == "Offer Extended":
				offer_ids.add(application.id)
		if record and record.status == "Placed":
			offer_ids.add(application.id)
			accepted_ids.add(application.id)
			placement_ids.add(application.id)
		offer = offers_by_application.get(application.id)
		if offer and offer.offer_status != "Draft":
			offer_ids.add(application.id)
		if offer and offer.offer_status == "Accepted":
			accepted_ids.add(application.id)
		if offer and offer.placement_status == "Confirmed":
			placement_ids.add(application.id)
			accepted_ids.add(application.id)
			offer_ids.add(application.id)
	interviewed_ids = {
		application_id
		for application_id, records in interviews_by_application.items()
		if any(record.status in INTERVIEWED_STATUSES for record in records)
	}

	app_count = len(applications)
	shortlisted_count = len(shortlisted_ids)
	interviewed_count = len(interviewed_ids)
	offer_count = len(offer_ids)
	accepted_count = len(accepted_ids)
	placement_count = len(placement_ids)

	job_performance: list[RecruiterJobPerformance] = []
	for jd in jobs:
		job_applications = applications_by_job.get(jd.id, [])
		job_application_ids = {application.id for application in job_applications}
		job_shortlisted = len(job_application_ids & shortlisted_ids)
		job_interviewed = len(
			job_application_ids
			& {
				application_id
				for application_id, records in interviews_by_application.items()
				if any(record.status in COUNTED_INTERVIEW_STATUSES for record in records)
			}
		)
		job_offers = len(job_application_ids & offer_ids)
		job_accepted = len(job_application_ids & accepted_ids)
		job_placements = len(job_application_ids & placement_ids)
		job_count = len(job_applications)
		job_performance.append(
			RecruiterJobPerformance(
				job_id=jd.id,
				role=jd.role_title,
				company=jd.company_name,
				category=jd.job_category,
				applications=job_count,
				shortlisted=job_shortlisted,
				interviews=job_interviewed,
				offers=job_offers,
				accepted=job_accepted,
				placements=job_placements,
				shortlist_rate=_percent(job_shortlisted, job_count),
				offer_rate=_percent(job_offers, job_count),
				placement_rate=_percent(job_placements, job_count),
				conversion_rate=_percent(job_placements, job_count),
			)
		)

	scores = list(fit_by_application.values())
	quality = CandidateQuality(
		average_fit_score=round(sum(scores) / len(scores), 2) if scores else None,
		highest_fit_score=round(max(scores), 2) if scores else None,
		strong_matches=sum(score >= 75 for score in scores),
		manual_review=sum(60 <= score < 75 for score in scores),
		excellent_matches=sum(score >= 90 for score in scores),
		potential_matches=sum(60 <= score < 75 for score in scores),
		low_matches=sum(score < 60 for score in scores),
	)

	skill_rows = _skill_insight_rows(requested_by_skill, candidate_by_skill, gaps_by_skill)
	most_requested = sorted(skill_rows, key=lambda row: (-row.job_count, row.skill.casefold()))[:8]
	strongest_coverage = sorted(
		(row for row in skill_rows if row.candidate_count),
		key=lambda row: (-row.coverage_rate, -row.candidate_count, row.skill.casefold()),
	)[:8]
	difficult_to_source = sorted(
		(row for row in skill_rows if row.gap_count),
		key=lambda row: (-row.gap_count, row.coverage_rate, row.skill.casefold()),
	)[:8]

	application_to_interview: list[float] = []
	applications_by_id = {application.id: application for application in applications}
	for application_id, records in interviews_by_application.items():
		application = applications_by_id.get(application_id)
		if application is None:
			continue
		eligible_interviews = [
			item for item in records if item.status in COUNTED_INTERVIEW_STATUSES
		]
		if not eligible_interviews:
			continue
		first_interview_created = min(_utc_naive(item.created_at) for item in eligible_interviews)
		days = (first_interview_created - _utc_naive(application.created_at)).total_seconds() / 86400
		if days >= 0:
			application_to_interview.append(days)
	speed = RecruitmentSpeed(
		application_to_interview_days=_average_days(application_to_interview),
		interview_to_offer_days=None,
		offer_to_placement_days=None,
	)

	funnel = [
		FunnelStage(name="Applications", count=app_count, conversion_rate=None),
		FunnelStage(name="Shortlisted", count=shortlisted_count, conversion_rate=_percent(shortlisted_count, app_count)),
		FunnelStage(name="Interviewed", count=interviewed_count, conversion_rate=_percent(interviewed_count, shortlisted_count)),
		FunnelStage(name="Offers", count=offer_count, conversion_rate=_percent(offer_count, interviewed_count)),
		FunnelStage(name="Accepted", count=accepted_count, conversion_rate=_percent(accepted_count, offer_count)),
		FunnelStage(name="Placed", count=placement_count, conversion_rate=_percent(placement_count, accepted_count)),
	]

	insights: list[str] = []
	volume_by_category: dict[str, int] = defaultdict(int)
	for item in job_performance:
		volume_by_category[item.category] += item.applications
	if volume_by_category:
		top_category = max(volume_by_category, key=lambda category_name: (volume_by_category[category_name], category_name))
		insights.append(
			f"{top_category.capitalize()} roles have the highest application volume "
			f"({volume_by_category[top_category]} applications)."
		)
	if job_performance:
		top_job = max(job_performance, key=lambda item: (item.applications, item.role.casefold()))
		if top_job.applications:
			insights.append(
				f"The highest-volume candidate pipeline is for {top_job.role} at {top_job.company} "
				f"({top_job.applications} applications)."
			)
	if difficult_to_source:
		top_gap = difficult_to_source[0]
		insights.append(
			f"{top_gap.skill} is the largest observed skill gap "
			f"({top_gap.gap_count} applicant profiles missing it)."
		)
	if offer_count:
		insights.append(
			f"Offer-to-placement conversion is {_percent(placement_count, offer_count):.2f}% "
			f"({placement_count} of {offer_count} offers/offer-extended records)."
		)
	if not insights:
		insights.append("There is not enough recruiter activity in this selection to generate hiring insights yet.")

	return RecruiterAnalyticsResponse(
		total_jobs=len(jobs),
		total_applications=app_count,
		shortlisted=shortlisted_count,
		interviews=sum(item.status in COUNTED_INTERVIEW_STATUSES for item in interviews),
		offers=offer_count,
		accepted=accepted_count,
		placements=placement_count,
		average_fit_score=quality.average_fit_score,
		offer_acceptance_rate=_percent(accepted_count, offer_count) if offer_count else None,
		placement_rate=_percent(placement_count, accepted_count) if accepted_count else None,
		funnel=funnel,
		job_performance=job_performance,
		candidate_quality=quality,
		most_requested_skills=most_requested,
		strongest_coverage_skills=strongest_coverage,
		difficult_to_source_skills=difficult_to_source,
		recruitment_speed=speed,
		insights=insights,
		applied_from=date_from,
		applied_to=date_to,
	)
