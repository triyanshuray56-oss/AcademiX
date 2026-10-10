from base64 import b64decode
from typing import Any, ClassVar, Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator

from backend.app.schemas.common import SchemaBase, UpdateSchema

ReadinessStatus = Literal["Not Ready", "Developing", "Ready", "Highly Employable"]
MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024
MAX_PROFILE_IMAGE_DATA_URL_LENGTH = 2_800_000
MAX_COLLEGE_ID_BYTES = 5 * 1024 * 1024
MAX_COLLEGE_ID_DATA_URL_LENGTH = 7_000_000


def validate_profile_picture(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if value.startswith(("https://", "http://")):
        parsed_url = urlsplit(value)
        if parsed_url.scheme in {"http", "https"} and parsed_url.netloc:
            return value
        raise ValueError("profile picture URL must be a valid HTTP(S) URL")
    if len(value) > MAX_PROFILE_IMAGE_DATA_URL_LENGTH:
        raise ValueError("profile picture must be no larger than 2 MB")
    if not value.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")):
        raise ValueError("profile picture must be a PNG/JPEG data URL or an HTTP(S) URL")
    encoded_image = value.split(",", maxsplit=1)[1]
    try:
        decoded_image = b64decode(encoded_image, validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError("profile picture data is not valid base64") from error
    if not decoded_image or len(decoded_image) > MAX_PROFILE_IMAGE_BYTES:
        raise ValueError("profile picture must be a non-empty image no larger than 2 MB")
    return value


def validate_college_id_card(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if value.startswith(("https://", "http://")):
        parsed_url = urlsplit(value)
        local_http = parsed_url.scheme == "http" and parsed_url.hostname in {"localhost", "127.0.0.1"}
        if parsed_url.netloc and (parsed_url.scheme == "https" or local_http):
            return value
        raise ValueError("college ID URL must use HTTPS (HTTP is allowed for localhost)")
    if len(value) > MAX_COLLEGE_ID_DATA_URL_LENGTH:
        raise ValueError("college ID file must be no larger than 5 MB")
    allowed_prefixes = (
        "data:image/png;base64,",
        "data:image/jpeg;base64,",
        "data:application/pdf;base64,",
    )
    prefix = next((item for item in allowed_prefixes if value.startswith(item)), None)
    if prefix is None:
        raise ValueError("college ID must be a PNG/JPEG/PDF data URL or a secure HTTPS URL")
    try:
        decoded_file = b64decode(value[len(prefix):], validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError("college ID file data is not valid base64") from error
    if not decoded_file or len(decoded_file) > MAX_COLLEGE_ID_BYTES:
        raise ValueError("college ID file must be non-empty and no larger than 5 MB")
    return value


class InternshipExperience(SchemaBase):
    company: str = Field(min_length=1, max_length=160)
    role: str = Field(default="Intern", max_length=120)
    duration_months: int = Field(ge=0, le=120)
    mentor_rating: float | None = Field(default=None, ge=0, le=100)
    description: str = Field(default="", max_length=1200)
    tech_stack: list[str] = Field(default_factory=list, max_length=30)


class ProjectShowcase(SchemaBase):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1600)
    preview_url: str | None = Field(default=None, max_length=500)
    repository_url: str | None = Field(default=None, max_length=500)
    tech_stack: list[str] = Field(default_factory=list, max_length=20)


class ResponsibilityEntry(SchemaBase):
    role: str = Field(min_length=1, max_length=160)
    organization: str = Field(min_length=1, max_length=160)
    duration: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=1600)


class AccomplishmentEntry(SchemaBase):
    title: str = Field(min_length=1, max_length=180)
    category: str = Field(default="Award", max_length=80)
    issuer: str = Field(default="", max_length=160)
    date: str = Field(default="", max_length=40)
    description: str = Field(default="", max_length=1600)
    score: float | None = Field(default=None, ge=0, le=5000)
    document_url: str | None = Field(default=None, max_length=1000)


class VolunteeringEntry(SchemaBase):
    organization: str = Field(min_length=1, max_length=160)
    role: str = Field(default="Volunteer", max_length=120)
    duration: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=1600)


class ExtracurricularEntry(SchemaBase):
    activity: str = Field(min_length=1, max_length=160)
    category: str = Field(default="Other", max_length=80)
    role: str = Field(default="Participant", max_length=120)
    description: str = Field(default="", max_length=1600)


class StudentBase(SchemaBase):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(
        min_length=3,
        max_length=255,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    branch: str = Field(min_length=1, max_length=40)
    cgpa: float = Field(ge=0, le=10)
    skills: str = ""
    readiness_score: float = Field(default=0.0, ge=0, le=100)
    readiness_status: ReadinessStatus = "Not Ready"
    mock_interview_score: float = Field(default=0.0, ge=0, le=100)
    flight_risk_score: float | None = Field(default=0.0, ge=0, le=100)
    qr_auth_token: str | None = None
    semester_cgpas: list[float | None] = Field(default_factory=list, max_length=8)
    active_backlogs: int = Field(default=0, ge=0)
    cleared_backlogs: int = Field(default=0, ge=0)
    tenth_percentage: float | None = Field(default=None, ge=0, le=100)
    twelfth_percentage: float | None = Field(default=None, ge=0, le=100)
    university_roll_number: str | None = Field(default=None, max_length=40)
    branch_rank: int | None = Field(default=None, ge=1)
    branch_percentile: float | None = Field(default=None, ge=0, le=100)
    leetcode_rating: float | None = Field(default=None, ge=0, le=5000)
    hackerrank_rating: float | None = Field(default=None, ge=0, le=5000)
    coding_score: float | None = Field(default=None, ge=0, le=100)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    system_design_score: float | None = Field(default=None, ge=0, le=100)
    verified_tech_stack: list[str] = Field(default_factory=list, max_length=80)
    ai_speech_score: float | None = Field(default=None, ge=0, le=100)
    aptitude_score: float | None = Field(default=None, ge=0, le=100)
    leadership_notes: str | None = Field(default=None, max_length=4000)
    internship_experiences: list[InternshipExperience] = Field(default_factory=list, max_length=30)
    mentor_rating: float | None = Field(default=None, ge=0, le=100)
    project_showcase: list[ProjectShowcase] = Field(default_factory=list, max_length=50)
    responsibilities: list[ResponsibilityEntry] = Field(default_factory=list, max_length=50)
    accomplishments: list[AccomplishmentEntry] = Field(default_factory=list, max_length=100)
    volunteering: list[VolunteeringEntry] = Field(default_factory=list, max_length=100)
    extracurriculars: list[ExtracurricularEntry] = Field(default_factory=list, max_length=100)
    resume_url: str | None = Field(default=None, max_length=500)
    resume_filename: str | None = Field(default=None, max_length=255)
    documents_confirmed: bool = False
    onboarding_complete: bool = False
    profile_picture_url: str | None = Field(default=None, max_length=MAX_PROFILE_IMAGE_DATA_URL_LENGTH)
    college_id_card_url: str | None = Field(default=None, max_length=MAX_COLLEGE_ID_DATA_URL_LENGTH)
    college_id_verified: bool = False

    @field_validator("semester_cgpas")
    @classmethod
    def validate_semester_values(cls, values: list[float | None]) -> list[float | None]:
        if any(value is not None and not 0 <= value <= 10 for value in values):
            raise ValueError("semester CGPA values must be between 0 and 10")
        return values

    @field_validator("verified_tech_stack")
    @classmethod
    def normalize_verified_stack(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))

    @field_validator("profile_picture_url")
    @classmethod
    def validate_profile_picture_value(cls, value: str | None) -> str | None:
        return validate_profile_picture(value)

    @field_validator("college_id_card_url")
    @classmethod
    def validate_college_id_value(cls, value: str | None) -> str | None:
        return validate_college_id_card(value)

class StudentCreate(StudentBase):
    """Validated payload for creating a student profile."""
    college_id_verified: Literal[False] = False


class StudentUpdate(UpdateSchema):
    NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
        {
            "name",
            "email",
            "branch",
            "cgpa",
            "skills",
            "readiness_score",
            "readiness_status",
            "mock_interview_score",
            "semester_cgpas",
            "active_backlogs",
            "cleared_backlogs",
            "verified_tech_stack",
            "internship_experiences",
            "project_showcase",
            "responsibilities",
            "accomplishments",
            "volunteering",
            "extracurriculars",
            "documents_confirmed",
            "onboarding_complete",
        }
    )

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(
        default=None,
        min_length=3,
        max_length=255,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    branch: str | None = Field(default=None, min_length=1, max_length=40)
    cgpa: float | None = Field(default=None, ge=0, le=10)
    skills: str | None = None
    readiness_score: float | None = Field(default=None, ge=0, le=100)
    readiness_status: ReadinessStatus | None = None
    mock_interview_score: float | None = Field(default=None, ge=0, le=100)
    flight_risk_score: float | None = Field(default=None, ge=0, le=100)
    qr_auth_token: str | None = None
    semester_cgpas: list[float | None] | None = Field(default=None, max_length=8)
    active_backlogs: int | None = Field(default=None, ge=0)
    cleared_backlogs: int | None = Field(default=None, ge=0)
    tenth_percentage: float | None = Field(default=None, ge=0, le=100)
    twelfth_percentage: float | None = Field(default=None, ge=0, le=100)
    university_roll_number: str | None = Field(default=None, max_length=40)
    branch_rank: int | None = Field(default=None, ge=1)
    branch_percentile: float | None = Field(default=None, ge=0, le=100)
    leetcode_rating: float | None = Field(default=None, ge=0, le=5000)
    hackerrank_rating: float | None = Field(default=None, ge=0, le=5000)
    coding_score: float | None = Field(default=None, ge=0, le=100)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    system_design_score: float | None = Field(default=None, ge=0, le=100)
    verified_tech_stack: list[str] | None = Field(default=None, max_length=80)
    ai_speech_score: float | None = Field(default=None, ge=0, le=100)
    aptitude_score: float | None = Field(default=None, ge=0, le=100)
    leadership_notes: str | None = Field(default=None, max_length=4000)
    internship_experiences: list[InternshipExperience] | None = Field(default=None, max_length=30)
    mentor_rating: float | None = Field(default=None, ge=0, le=100)
    project_showcase: list[ProjectShowcase] | None = Field(default=None, max_length=50)
    responsibilities: list[ResponsibilityEntry] | None = Field(default=None, max_length=50)
    accomplishments: list[AccomplishmentEntry] | None = Field(default=None, max_length=100)
    volunteering: list[VolunteeringEntry] | None = Field(default=None, max_length=100)
    extracurriculars: list[ExtracurricularEntry] | None = Field(default=None, max_length=100)
    resume_url: str | None = Field(default=None, max_length=500)
    resume_filename: str | None = Field(default=None, max_length=255)
    documents_confirmed: bool | None = None
    onboarding_complete: bool | None = None
    profile_picture_url: str | None = Field(default=None, max_length=MAX_PROFILE_IMAGE_DATA_URL_LENGTH)
    college_id_card_url: str | None = Field(default=None, max_length=MAX_COLLEGE_ID_DATA_URL_LENGTH)

    @field_validator("semester_cgpas")
    @classmethod
    def validate_update_semester_values(
        cls,
        values: list[float | None] | None,
    ) -> list[float | None] | None:
        if values is not None and any(value is not None and not 0 <= value <= 10 for value in values):
            raise ValueError("semester CGPA values must be between 0 and 10")
        return values

    @field_validator("verified_tech_stack")
    @classmethod
    def normalize_update_verified_stack(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))

    @field_validator("profile_picture_url")
    @classmethod
    def validate_update_profile_picture(cls, value: str | None) -> str | None:
        return validate_profile_picture(value)

    @field_validator("college_id_card_url")
    @classmethod
    def validate_update_college_id(cls, value: str | None) -> str | None:
        return validate_college_id_card(value)


class Student(StudentBase):
    id: int

StudentRead = Student


class StudentOnboarding(SchemaBase):
    name: str = Field(min_length=1, max_length=120)
    branch: str = Field(min_length=1, max_length=40)
    cgpa: float = Field(ge=0, le=10)
    semester_cgpas: list[float | None] = Field(default_factory=list, max_length=8)
    active_backlogs: int = Field(default=0, ge=0)
    cleared_backlogs: int = Field(default=0, ge=0)
    tenth_percentage: float | None = Field(default=None, ge=0, le=100)
    twelfth_percentage: float | None = Field(default=None, ge=0, le=100)
    university_roll_number: str = Field(min_length=1, max_length=40)
    verified_tech_stack: list[str] = Field(min_length=1, max_length=80)
    leetcode_rating: float | None = Field(default=None, ge=0, le=5000)
    hackerrank_rating: float | None = Field(default=None, ge=0, le=5000)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    resume_url: str | None = Field(default=None, max_length=500)
    resume_filename: str | None = Field(default=None, max_length=255)
    documents_confirmed: bool = False
    profile_picture_url: str | None = Field(default=None, max_length=MAX_PROFILE_IMAGE_DATA_URL_LENGTH)
    college_id_card_url: str | None = Field(default=None, max_length=MAX_COLLEGE_ID_DATA_URL_LENGTH)
    internship_experiences: list[InternshipExperience] = Field(default_factory=list, max_length=30)
    project_showcase: list[ProjectShowcase] = Field(default_factory=list, max_length=50)
    responsibilities: list[ResponsibilityEntry] = Field(default_factory=list, max_length=50)
    accomplishments: list[AccomplishmentEntry] = Field(default_factory=list, max_length=100)
    volunteering: list[VolunteeringEntry] = Field(default_factory=list, max_length=100)
    extracurriculars: list[ExtracurricularEntry] = Field(default_factory=list, max_length=100)

    @field_validator("semester_cgpas")
    @classmethod
    def validate_semester_cgpas(
        cls,
        values: list[float | None],
    ) -> list[float | None]:
        if any(value is not None and not 0 <= value <= 10 for value in values):
            raise ValueError("semester CGPA values must be between 0 and 10")
        return values

    @field_validator("verified_tech_stack")
    @classmethod
    def normalize_tech_stack(cls, values: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if not cleaned:
            raise ValueError("select at least one technical skill")
        return cleaned

    @field_validator("profile_picture_url")
    @classmethod
    def validate_onboarding_profile_picture(cls, value: str | None) -> str | None:
        return validate_profile_picture(value)

    @field_validator("college_id_card_url")
    @classmethod
    def validate_onboarding_college_id(cls, value: str | None) -> str | None:
        return validate_college_id_card(value)


class CollegeIdVerificationUpdate(SchemaBase):
    college_id_verified: bool


class StudentAssessmentUpdate(SchemaBase):
    mock_interview_score: float = Field(ge=0, le=100)
    system_design_score: float = Field(ge=0, le=100)
    ai_speech_score: float = Field(ge=0, le=100)
    aptitude_score: float = Field(ge=0, le=100)
