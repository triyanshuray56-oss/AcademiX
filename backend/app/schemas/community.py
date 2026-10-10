"""Request and response schemas for the additive student community module."""

from pydantic import Field

from backend.app.schemas.common import SchemaBase


class StudentRankItem(SchemaBase):
    student_id: str
    name: str
    college_name: str
    avatar_url: str | None = None
    target_role: str
    global_score: int = Field(ge=0, le=100)
    rank: int = Field(ge=1)
    streak_days: int = Field(ge=0)
    problems_solved: int = Field(ge=0)
    badges: list[str]
    proctoring_avg_trust: float = Field(ge=0, le=100)


class RecruiterTalentItem(SchemaBase):
    student_id: str
    name: str
    branch: str
    target_role: str
    talent_score: int = Field(ge=0, le=100)
    global_rank: int = Field(ge=1)
    technical_score: float | None = None
    skills: list[str]
    badges: list[str]
    project_count: int = Field(ge=0)
    summary: str
    previous_readiness: float | None = None
    current_readiness: float | None = None
    readiness_change: float | None = None
    previous_snapshot_date: str | None = None
    current_snapshot_date: str | None = None


class RecruiterScoutFilter(SchemaBase):
    domain: str | None = None
    min_score: int | None = Field(default=None, ge=0, le=100)
    hire_ready_only: bool = False
    limit: int = Field(default=20, ge=1, le=100)


class DirectScoutAction(SchemaBase):
    recruiter_id: str = Field(min_length=1, max_length=255)
    student_id: str = Field(min_length=1, max_length=40)
    opportunity_title: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=2000)


class DirectConnectResult(SchemaBase):
    invite_id: str
    status: str
    message: str
