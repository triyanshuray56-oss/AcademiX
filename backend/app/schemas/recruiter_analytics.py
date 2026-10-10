from datetime import date

from backend.app.schemas.common import SchemaBase


class FunnelStage(SchemaBase):
	name: str
	count: int
	conversion_rate: float | None


class RecruiterJobPerformance(SchemaBase):
	job_id: int
	role: str
	company: str
	category: str
	applications: int
	shortlisted: int
	interviews: int
	offers: int
	accepted: int
	placements: int
	shortlist_rate: float
	offer_rate: float
	placement_rate: float
	conversion_rate: float


class SkillInsight(SchemaBase):
	skill: str
	job_count: int
	candidate_count: int
	gap_count: int
	coverage_rate: float


class RecruitmentSpeed(SchemaBase):
	application_to_interview_days: float | None
	interview_to_offer_days: float | None
	offer_to_placement_days: float | None


class CandidateQuality(SchemaBase):
	average_fit_score: float | None
	highest_fit_score: float | None
	strong_matches: int
	manual_review: int
	excellent_matches: int
	potential_matches: int
	low_matches: int


class RecruiterAnalyticsResponse(SchemaBase):
	total_jobs: int
	total_applications: int
	shortlisted: int
	interviews: int
	offers: int
	accepted: int
	placements: int
	average_fit_score: float | None
	offer_acceptance_rate: float | None
	placement_rate: float | None
	funnel: list[FunnelStage]
	job_performance: list[RecruiterJobPerformance]
	candidate_quality: CandidateQuality
	most_requested_skills: list[SkillInsight]
	strongest_coverage_skills: list[SkillInsight]
	difficult_to_source_skills: list[SkillInsight]
	recruitment_speed: RecruitmentSpeed
	insights: list[str]
	applied_from: date | None
	applied_to: date | None
