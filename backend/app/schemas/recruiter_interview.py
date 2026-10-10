from datetime import datetime
from typing import ClassVar, Literal

from pydantic import Field

from backend.app.schemas.common import SchemaBase, UpdateSchema

InterviewType = Literal["Technical", "HR", "Managerial", "Technical + HR"]
InterviewStatus = Literal["Scheduled", "In Progress", "Completed", "Cancelled", "No Show"]


class RecruiterInterviewCreate(SchemaBase):
	application_id: int = Field(ge=1)
	interview_type: InterviewType
	scheduled_at: datetime
	duration_minutes: int = Field(gt=0, le=720)
	interviewer: str = Field(min_length=1, max_length=160)
	meeting_link: str = Field(default="", max_length=1000)
	notes: str = Field(default="", max_length=10000)


class RecruiterInterviewUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"scheduled_at", "duration_minutes", "interviewer", "meeting_link", "notes", "status"}
	)

	scheduled_at: datetime | None = None
	duration_minutes: int | None = Field(default=None, gt=0, le=720)
	interviewer: str | None = Field(default=None, min_length=1, max_length=160)
	meeting_link: str | None = Field(default=None, max_length=1000)
	notes: str | None = Field(default=None, max_length=10000)
	status: InterviewStatus | None = None


class RecruiterAssessmentViolation(SchemaBase):
	event_type: str
	timestamp: datetime
	strike_count: int


class RecruiterCandidateAssessment(SchemaBase):
	assessment_id: str
	trust_score: float
	current_strikes: int
	auto_submit_triggered: bool
	completed: bool
	violations: list[RecruiterAssessmentViolation]


class RecruiterInterviewRead(SchemaBase):
	id: int
	application_id: int
	student_id: int
	candidate_name: str
	candidate_branch: str
	candidate_cgpa: float
	job_title: str
	company_name: str
	interview_type: str
	scheduled_at: datetime
	duration_minutes: int
	interviewer: str
	meeting_link: str
	notes: str
	status: str
	created_at: datetime
	assessments: list[RecruiterCandidateAssessment]
