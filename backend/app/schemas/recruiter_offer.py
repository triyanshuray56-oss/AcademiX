from datetime import date, datetime
from typing import ClassVar, Literal

from pydantic import Field, model_validator

from backend.app.schemas.common import SchemaBase, UpdateSchema

OfferStatus = Literal["Draft", "Offer Sent", "Accepted", "Declined"]
PlacementStatus = Literal["Not Confirmed", "Confirmed"]


class RecruiterOfferCreate(SchemaBase):
	application_id: int = Field(ge=1)
	recruiter_jd_id: int = Field(ge=1)
	package_lpa: float | None = Field(default=None, ge=0)
	offer_date: datetime
	joining_date: date | None = None
	location: str | None = Field(default=None, max_length=240)
	notes: str = Field(default="", max_length=10000)


class RecruiterOfferUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"package_lpa", "offer_date", "notes", "offer_status", "placement_status"}
	)

	package_lpa: float | None = Field(default=None, ge=0)
	offer_date: datetime | None = None
	joining_date: date | None = None
	location: str | None = Field(default=None, max_length=240)
	notes: str | None = Field(default=None, max_length=10000)
	offer_status: OfferStatus | None = None
	placement_status: PlacementStatus | None = None

	@model_validator(mode="after")
	def require_update(self):
		if not self.model_fields_set:
			raise ValueError("At least one offer field must be provided")
		return self


class RecruiterOfferRead(SchemaBase):
	id: int
	application_id: int
	student_id: int
	candidate_name: str
	candidate_branch: str
	candidate_cgpa: float
	recruiter_jd_id: int
	job_title: str
	company_name: str
	package_lpa: float
	offer_date: datetime
	joining_date: date | None
	location: str | None
	employment_type: str
	notes: str
	offer_status: str
	placement_status: str
	application_status: str
	latest_interview_status: str | None
	created_at: datetime
	updated_at: datetime
