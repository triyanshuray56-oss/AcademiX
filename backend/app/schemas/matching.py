from typing import ClassVar, Literal

from pydantic import Field

from backend.app.schemas.common import SchemaBase, UpdateSchema

MatchStatus = Literal["Placed", "In-Progress", "Pending"]
RecruiterActionStatus = Literal[
	"Not Actioned",
	"Shortlisted",
	"Interview Scheduled",
	"Offer Extended",
]


class MatchRecordBase(SchemaBase):
	student_id: int = Field(gt=0)
	jd_id: int = Field(gt=0)
	fit_score: float = Field(ge=0, le=100)
	explanation: str = ""
	status: MatchStatus = "Pending"
	recruiter_action_status: RecruiterActionStatus = "Not Actioned"


class MatchRecordCreate(MatchRecordBase):
	"""Validated payload for creating a student-to-JD match."""


class MatchRecordUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"student_id", "jd_id", "fit_score", "explanation", "status"}
	)

	student_id: int | None = Field(default=None, gt=0)
	jd_id: int | None = Field(default=None, gt=0)
	fit_score: float | None = Field(default=None, ge=0, le=100)
	explanation: str | None = None
	status: MatchStatus | None = None
	recruiter_action_status: RecruiterActionStatus | None = None


class MatchRecord(MatchRecordBase):
	id: int

MatchRecordRead = MatchRecord


class RecruiterActionUpdate(SchemaBase):
	status: RecruiterActionStatus