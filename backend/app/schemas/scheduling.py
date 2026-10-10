from datetime import datetime
from typing import ClassVar, Literal

from pydantic import Field

from backend.app.schemas.common import SchemaBase, UpdateSchema

DriveStatus = Literal["Scheduled", "Completed", "Conflicted"]


class PlacementDriveBase(SchemaBase):
	company_name: str = Field(min_length=1, max_length=120)
	drive_date: datetime
	registration_deadline: datetime | None = None
	venue: str = Field(min_length=1, max_length=160)
	status: DriveStatus = "Scheduled"


class PlacementDriveCreate(PlacementDriveBase):
	"""Validated payload for creating a placement drive."""


class PlacementDriveUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"company_name", "drive_date", "venue", "status"}
	)

	company_name: str | None = Field(default=None, min_length=1, max_length=120)
	drive_date: datetime | None = None
	registration_deadline: datetime | None = None
	venue: str | None = Field(default=None, min_length=1, max_length=160)
	status: DriveStatus | None = None


class PlacementDrive(PlacementDriveBase):
	id: int

PlacementDriveRead = PlacementDrive
