from backend.app.schemas.matching import (
	MatchRecord,
	MatchRecordCreate,
	MatchRecordRead,
	MatchRecordUpdate,
)
from backend.app.schemas.recruiter import (
	RecruiterJD,
	RecruiterJDCreate,
	RecruiterJDRead,
	RecruiterJDUpdate,
)
from backend.app.schemas.scheduling import (
	PlacementDrive,
	PlacementDriveCreate,
	PlacementDriveRead,
	PlacementDriveUpdate,
)
from backend.app.schemas.student import Student, StudentCreate, StudentRead, StudentUpdate

__all__ = [
	"MatchRecord",
	"MatchRecordCreate",
	"MatchRecordRead",
	"MatchRecordUpdate",
	"PlacementDrive",
	"PlacementDriveCreate",
	"PlacementDriveRead",
	"PlacementDriveUpdate",
	"RecruiterJD",
	"RecruiterJDCreate",
	"RecruiterJDRead",
	"RecruiterJDUpdate",
	"Student",
	"StudentCreate",
	"StudentRead",
	"StudentUpdate",
]