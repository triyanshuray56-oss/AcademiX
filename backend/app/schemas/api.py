from typing import Literal

from pydantic import BaseModel, Field

from backend.app.schemas.matching import MatchRecord as MatchRecordSchema
from backend.app.schemas.scheduling import PlacementDrive as PlacementDriveSchema
from backend.app.schemas.student import Student as StudentSchema

DriveConflictType = Literal[
    "same_date",
    "same_datetime",
    "same_venue",
    "student_overlap",
]


class DriveConflict(BaseModel):
    drive_ids: list[int]
    conflict_types: list[DriveConflictType]
    student_ids: list[int] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class DriveListResponse(BaseModel):
    drives: list[PlacementDriveSchema]
    conflicts: list[DriveConflict]


class MatchRunResponse(BaseModel):
    drive_id: int
    company_name: str
    eligible_student_count: int
    created_records: int
    updated_records: int
    shortlisted_count: int
    matches: list[MatchRecordSchema]


class DeepProfileMatchFactor(BaseModel):
    drive_id: int
    company_name: str
    jd_id: int
    role_title: str
    fit_score: float
    min_cgpa: float
    cgpa_eligible: bool
    matched_skills: list[str]
    missing_skills: list[str]
    reason: str
    match_record_id: int | None = None
    match_status: str | None = None
    recruiter_action_status: str = "Not Actioned"


class StudentDeepProfileResponse(BaseModel):
    student: StudentSchema
    active_drive_match_factors: list[DeepProfileMatchFactor]


class StudentDashboardAnalytics(BaseModel):
    branch_average_coding: float | None = None
    branch_average_leetcode: float | None = None
    branch_student_count: int = 0
    tracked_match_count: int = 0
    pipeline_counts: dict[str, int] = Field(default_factory=dict)
    is_demo_data: bool = False


class DashboardAnalytics(BaseModel):
    total_students: int
    placement_ready_count: int
    active_drives_count: int
    offers_accepted: int
    branch_conversion_percentages: dict[str, float]
    package_trends: dict[str, float]
    at_risk_unplaced_count: int


class MessageResponse(BaseModel):
    detail: str


class NudgeRecommendation(BaseModel):
    skill: str
    challenge: str
    reward_xp: int
    estimated_minutes: int


class StudentNudgeResponse(BaseModel):
    student_id: int
    current_readiness_score: float
    forecast_readiness_score: float
    readiness_score_bump: float
    missing_skills: list[str]
    recommendations: list[NudgeRecommendation]
    message: str
