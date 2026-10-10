from typing import ClassVar
from datetime import datetime

import json

from pydantic import Field, field_validator

from backend.app.schemas.common import SchemaBase, UpdateSchema


class RecruiterJDBase(SchemaBase):
	company_name: str = Field(min_length=1, max_length=120)
	role_title: str = Field(min_length=1, max_length=160)
	min_cgpa: float = Field(ge=0, le=10)
	required_skills: str = Field(min_length=1)
	package_lpa: float = Field(ge=0)
	application_deadline: datetime | None = None
	job_category: str = Field(default="job", pattern="^(job|internship)$")
	description: str = Field(default="", max_length=10000)
	eligible_branches: list[str] = Field(default_factory=list, max_length=50)

	@field_validator("eligible_branches", mode="before")
	@classmethod
	def parse_eligible_branches(cls, value):
		if isinstance(value, str):
			try:
				value = json.loads(value)
			except (TypeError, ValueError):
				value = []
		return value


class RecruiterJDCreate(RecruiterJDBase):
	"""Validated payload for creating a recruiter job description."""


class RecruiterJDUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"company_name", "role_title", "min_cgpa", "required_skills", "package_lpa", "job_category", "description", "eligible_branches"}
	)

	company_name: str | None = Field(default=None, min_length=1, max_length=120)
	role_title: str | None = Field(default=None, min_length=1, max_length=160)
	min_cgpa: float | None = Field(default=None, ge=0, le=10)
	required_skills: str | None = Field(default=None, min_length=1)
	package_lpa: float | None = Field(default=None, ge=0)
	application_deadline: datetime | None = None
	job_category: str | None = Field(default=None, pattern="^(job|internship)$")
	description: str | None = Field(default=None, max_length=10000)
	eligible_branches: list[str] | None = Field(default=None, max_length=50)


class RecruiterJD(RecruiterJDBase):
	id: int

RecruiterJDRead = RecruiterJD


class ApplicantOverview(SchemaBase):
	application_id: int
	student_id: int
	student_name: str
	student_branch: str
	student_cgpa: float
	job_title: str
	status: str
	fit_score: float
	created_at: datetime


class ApplicantStatusUpdate(SchemaBase):
	status: str


class ApplicantAIBrief(SchemaBase):
	strengths: list[str]
	concerns: list[str]
	job_alignment: str
	interview_focus: list[str]
	recommendation: str


class CandidatePitchResponse(SchemaBase):
	pitch: str
