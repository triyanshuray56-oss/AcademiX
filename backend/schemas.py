"""Public Pydantic schema exports for the CampusLink backend."""

from backend.app.schemas import (
	MatchRecord,
	MatchRecordCreate,
	MatchRecordRead,
	MatchRecordUpdate,
	PlacementDrive,
	PlacementDriveCreate,
	PlacementDriveRead,
	PlacementDriveUpdate,
	RecruiterJD,
	RecruiterJDCreate,
	RecruiterJDRead,
	RecruiterJDUpdate,
	Student,
	StudentCreate,
	StudentRead,
	StudentUpdate,
)

__all__ = [
	"Student",
	"StudentCreate",
	"StudentRead",
	"StudentUpdate",
	"RecruiterJD",
	"RecruiterJDCreate",
	"RecruiterJDRead",
	"RecruiterJDUpdate",
	"PlacementDrive",
	"PlacementDriveCreate",
	"PlacementDriveRead",
	"PlacementDriveUpdate",
	"MatchRecord",
	"MatchRecordCreate",
	"MatchRecordRead",
	"MatchRecordUpdate",
]