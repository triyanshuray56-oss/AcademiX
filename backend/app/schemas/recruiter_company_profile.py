import re
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator

from backend.app.schemas.common import SchemaBase

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RecruiterAccountRead(SchemaBase):
	email: str
	role: Literal["recruiter"]
	is_active: bool


class RecruiterCompanyProfileUpdate(SchemaBase):
	company_name: str | None = Field(default=None, max_length=160)
	description: str | None = Field(default=None, max_length=5000)
	website: AnyHttpUrl | None = None
	logo_url: AnyHttpUrl | None = None
	location: str | None = Field(default=None, max_length=240)
	industry: str | None = Field(default=None, max_length=120)
	contact_name: str | None = Field(default=None, max_length=160)
	contact_email: str | None = Field(default=None, max_length=255)
	contact_phone: str | None = Field(default=None, max_length=50)

	@field_validator(
		"company_name",
		"description",
		"website",
		"logo_url",
		"location",
		"industry",
		"contact_name",
		"contact_email",
		"contact_phone",
		mode="before",
	)
	@classmethod
	def normalize_blank_values(cls, value):
		if isinstance(value, str):
			value = value.strip()
			return value or None
		return value

	@field_validator("contact_email")
	@classmethod
	def validate_contact_email(cls, value: str | None) -> str | None:
		if value is not None and not _EMAIL_PATTERN.fullmatch(value):
			raise ValueError("Enter a valid contact email address")
		return value


class RecruiterCompanyProfileRead(SchemaBase):
	account: RecruiterAccountRead
	company_name: str | None
	description: str | None
	website: str | None
	logo_url: str | None
	location: str | None
	industry: str | None
	contact_name: str | None
	contact_email: str | None
	contact_phone: str | None
