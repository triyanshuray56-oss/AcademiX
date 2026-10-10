from datetime import date, datetime
from typing import ClassVar, Literal, Self

from pydantic import Field, model_validator

from backend.app.schemas.common import SchemaBase, UpdateSchema

AdminManagedRole = Literal["student", "recruiter", "admin"]


class AdminUserRead(SchemaBase):
	id: int
	email: str
	role: AdminManagedRole
	is_active: bool


class AdminUserUpdate(SchemaBase):
	role: AdminManagedRole | None = None
	is_active: bool | None = None

	@model_validator(mode="after")
	def validate_update(self) -> Self:
		if not self.model_fields_set:
			raise ValueError("At least one account field must be provided")
		if any(getattr(self, name) is None for name in self.model_fields_set):
			raise ValueError("Account update fields cannot be null")
		return self


class AdminStudentRead(SchemaBase):
	id: int
	name: str
	email: str
	branch: str
	university_roll_number: str | None
	cgpa: float
	active_backlogs: int
	cleared_backlogs: int
	skills: str
	onboarding_complete: bool
	documents_confirmed: bool
	college_id_verified: bool


class AdminRecruiterRead(SchemaBase):
	id: int
	email: str
	is_active: bool
	company_name: str | None
	description: str | None
	website: str | None
	location: str | None
	industry: str | None
	job_posting_count: int | None = Field(default=None, ge=0)


AdminDriveStatus = Literal["Scheduled", "Completed", "Conflicted"]
AdminEligibilityResult = Literal[
	"Meets recorded criteria",
	"Does not meet recorded criteria",
	"Requires review",
]


def _validate_drive_dates(
	drive_date: datetime,
	registration_deadline: datetime | None,
) -> None:
	if registration_deadline is None:
		return
	if (drive_date.utcoffset() is None) != (registration_deadline.utcoffset() is None):
		raise ValueError("Drive date and registration deadline must use the same timezone format")
	if registration_deadline > drive_date:
		raise ValueError("Registration deadline cannot be after the drive date")


class AdminPlacementDriveCreate(SchemaBase):
	company_name: str = Field(min_length=1, max_length=120)
	drive_date: datetime
	registration_deadline: datetime | None = None
	venue: str = Field(min_length=1, max_length=160)
	status: AdminDriveStatus = "Scheduled"

	@model_validator(mode="after")
	def validate_dates(self) -> Self:
		if not self.company_name.strip() or not self.venue.strip():
			raise ValueError("Company and venue are required")
		_validate_drive_dates(self.drive_date, self.registration_deadline)
		return self


class AdminPlacementDriveUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"company_name", "drive_date", "venue", "status"}
	)

	company_name: str | None = Field(default=None, min_length=1, max_length=120)
	drive_date: datetime | None = None
	registration_deadline: datetime | None = None
	venue: str | None = Field(default=None, min_length=1, max_length=160)
	status: AdminDriveStatus | None = None

	@model_validator(mode="after")
	def validate_update(self) -> Self:
		if not self.model_fields_set:
			raise ValueError("At least one drive field must be provided")
		for field_name in ("company_name", "venue"):
			value = getattr(self, field_name)
			if field_name in self.model_fields_set and value is not None and not value.strip():
				raise ValueError(f"{field_name.replace('_', ' ').title()} is required")
		if self.drive_date is not None and self.registration_deadline is not None:
			_validate_drive_dates(self.drive_date, self.registration_deadline)
		return self


class AdminEligibilityJobRead(SchemaBase):
	id: int
	company_name: str
	role_title: str
	job_category: str
	min_cgpa: float
	required_skills: str
	eligible_branches: list[str] | None
	application_deadline: datetime | None


class AdminPlacementDriveRead(SchemaBase):
	id: int
	company_name: str
	drive_date: datetime
	registration_deadline: datetime | None
	venue: str
	status: AdminDriveStatus
	conflicting_drive_ids: list[int]
	recruiter_jobs: list[AdminEligibilityJobRead]


class AdminApplicationInterviewRead(SchemaBase):
	id: int
	interview_type: str
	scheduled_at: datetime
	duration_minutes: int
	interviewer: str
	status: str


class AdminApplicationOfferRead(SchemaBase):
	id: int
	package_lpa: float
	offer_date: datetime
	joining_date: date | None
	location: str | None
	employment_type: str
	offer_status: str
	placement_status: str


class AdminApplicationRead(SchemaBase):
	id: int
	student_id: int
	student_name: str
	student_email: str
	branch: str
	cgpa: float
	job_title: str
	company_name: str
	status: str
	created_at: datetime
	interviews: list[AdminApplicationInterviewRead]
	offers: list[AdminApplicationOfferRead]


class AdminEligibilityStudentRead(SchemaBase):
	student_id: int
	name: str
	email: str
	branch: str
	cgpa: float
	active_backlogs: int
	cleared_backlogs: int
	result: AdminEligibilityResult
	reason: str
	fit_score: float
	matched_skills: list[str]
	missing_skills: list[str]
	documents_confirmed: bool
	college_id_verified: bool
	warnings: list[str]


class AdminEligibilityRoleRead(AdminEligibilityJobRead):
	students: list[AdminEligibilityStudentRead]


class AdminEligibilityReviewRead(SchemaBase):
	target_type: Literal["drive", "job"]
	target_id: int
	target_label: str
	roles: list[AdminEligibilityRoleRead]
	message: str | None = None


class AdminBranchUsageRead(SchemaBase):
	name: str
	student_count: int = Field(ge=0)


class AdminOrganizationRead(SchemaBase):
	departments_available: bool
	department_message: str
	branches: list[AdminBranchUsageRead]
	unassigned_student_count: int = Field(ge=0)


class AdminAnnouncementRead(SchemaBase):
	id: int
	title: str
	message: str
	category: str
	priority: str
	published_at: datetime
	created_by: str | None = None
	is_published: bool = True


class AdminAnnouncementCreate(SchemaBase):
	title: str = Field(min_length=3, max_length=200)
	message: str = Field(min_length=3, max_length=10000)
	category: str = Field(default="General", min_length=2, max_length=80)
	priority: Literal["Low", "Normal", "High"] = "Normal"
	published_at: datetime | None = None


class AdminAnnouncementUpdate(UpdateSchema):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset(
		{"title", "message", "category", "priority"}
	)

	title: str | None = Field(default=None, min_length=3, max_length=200)
	message: str | None = Field(default=None, min_length=3, max_length=10000)
	category: str | None = Field(default=None, min_length=2, max_length=80)
	priority: Literal["Low", "Normal", "High"] | None = None
	is_published: bool | None = None


class AdminReportSummaryRead(SchemaBase):
	generated_at: datetime
	students: int = Field(ge=0)
	active_recruiters: int = Field(ge=0)
	active_admins: int = Field(ge=0)
	scheduled_drives: int = Field(ge=0)
	conflicted_drives: int = Field(ge=0)
	open_applications: int = Field(ge=0)
	published_announcements: int = Field(ge=0)
	unverified_students: int = Field(ge=0)
	inactive_accounts: int = Field(ge=0)


class AdminReportExportRead(SchemaBase):
	filename: str
	content: str
	media_type: str = "text/csv; charset=utf-8"


class AdminAuditEntryRead(SchemaBase):
	category: str
	label: str
	detail: str
	severity: Literal["info", "warning", "critical"]
	recorded_at: datetime


class AdminAuditSummaryRead(SchemaBase):
	generated_at: datetime
	security_status: str
	active_admins: int = Field(ge=0)
	inactive_accounts: int = Field(ge=0)
	unverified_students: int = Field(ge=0)
	conflicted_drives: int = Field(ge=0)
	warnings: list[str]
	entries: list[AdminAuditEntryRead]


class AdminSettingRead(SchemaBase):
	key: str
	label: str
	value: str | bool | int | list[str]
	updated_at: datetime | None = None


class AdminSettingsRead(SchemaBase):
	organization_name: str
	announcement_channels: list[str]
	email_notifications_enabled: bool
	export_formats: list[str]
	require_admin_approval_for_role_changes: bool
	settings: list[AdminSettingRead]


class AdminIntegrationStatusRead(SchemaBase):
	name: str
	status: Literal["online", "degraded", "offline"]
	detail: str


# ==============================================================================
# Phase 4 Schemas (Modules 13–18)
# ==============================================================================

# Module 13: Attendance & Assessment Oversight
class AdminAssessmentSessionRead(SchemaBase):
	session_id: str
	student_id: int
	student_name: str
	student_email: str
	assessment_id: str
	current_strikes: int
	trust_score: float
	mobile_connected: bool
	auto_submit_triggered: bool
	last_ping: datetime
	created_at: datetime
	closed_at: datetime | None = None
	status: str


class AdminAssessmentViolationRead(SchemaBase):
	id: int
	session_id: str
	event_type: str
	timestamp: datetime
	strike_count: int


class AdminDriveAttendanceRead(SchemaBase):
	drive_id: int
	company_name: str
	drive_date: datetime
	venue: str
	status: str
	panel_throughput_rate: int | None = None


class AdminOversightSummaryRead(SchemaBase):
	generated_at: datetime
	total_assessment_sessions: int = Field(ge=0)
	flagged_sessions: int = Field(ge=0)
	average_trust_score: float
	total_violations: int = Field(ge=0)
	active_drive_sessions: int = Field(ge=0)
	sessions: list[AdminAssessmentSessionRead]
	violations: list[AdminAssessmentViolationRead]
	drives: list[AdminDriveAttendanceRead]


# Module 14: Grievances & Support Requests
class AdminGrievanceItemRead(SchemaBase):
	id: int
	requester_email: str
	requester_name: str
	category: str
	subject: str
	message: str
	status: Literal["pending", "in_review", "resolved", "dismissed"]
	created_at: datetime
	updated_at: datetime | None = None
	assigned_to: str | None = None
	resolution_note: str | None = None


class AdminGrievanceStatusUpdate(SchemaBase):
	status: Literal["pending", "in_review", "resolved", "dismissed"]
	resolution_note: str | None = None


# Module 15: Data Quality & Import Management
class AdminImportRowError(SchemaBase):
	row_number: int
	field: str
	message: str
	invalid_value: str | None = None


class AdminImportPreviewRow(SchemaBase):
	row_number: int
	name: str
	email: str
	branch: str
	cgpa: float
	university_roll_number: str | None = None
	active_backlogs: int = 0
	skills: str = ""
	is_valid: bool
	is_duplicate: bool
	error_message: str | None = None


class AdminImportPreviewRead(SchemaBase):
	total_rows: int
	valid_count: int
	invalid_count: int
	duplicate_count: int
	supported_entity: str = "students"
	errors: list[AdminImportRowError]
	preview_rows: list[AdminImportPreviewRow]


class AdminImportCommitPayload(SchemaBase):
	confirm: bool = True
	csv_content: str


class AdminImportCommitResult(SchemaBase):
	success: bool
	imported_count: int
	skipped_count: int
	failed_count: int
	message: str


# Module 16: Backup & Recovery Management
class AdminBackupArtifact(SchemaBase):
	filename: str
	path: str
	size_bytes: int
	created_at: datetime
	is_verified: bool


class AdminDatabaseStatusRead(SchemaBase):
	database_type: str = "SQLite"
	database_path: str
	file_size_bytes: int
	table_count: int
	record_counts: dict[str, int]
	last_modified: datetime
	wal_enabled: bool
	automation_status: str
	available_backups: list[AdminBackupArtifact]
	safe_instructions: list[str]
	restore_enabled: bool = False


# Module 17: Notification & Delivery Monitoring
class AdminNotificationChannelStatus(SchemaBase):
	channel_name: str
	status: Literal["active", "not_configured", "offline"]
	provider: str
	description: str
	active_items_count: int
	delivery_confirmation_supported: bool


class AdminMonitoredNotificationItem(SchemaBase):
	id: str
	title: str
	channel: str
	category: str
	priority: str
	audience: str
	status: str
	created_at: datetime
	published_at: datetime | None = None


class AdminNotificationMonitoringSummary(SchemaBase):
	generated_at: datetime
	channels: list[AdminNotificationChannelStatus]
	in_app_active_count: int
	external_configured: bool
	external_delivery_notice: str
	recent_notifications: list[AdminMonitoredNotificationItem]


# Module 18: Policy & Eligibility Rules
class AdminReadinessPolicyRule(SchemaBase):
	name: str
	weight_percent: int
	formula: str
	description: str


class AdminReadinessTier(SchemaBase):
	tier_name: str
	score_range: str
	description: str
	current_student_count: int


class AdminVerificationPolicy(SchemaBase):
	rule_name: str
	required: bool
	criteria_field: str
	description: str
	compliant_student_count: int
	pending_student_count: int


class AdminEligibilityPolicyRead(SchemaBase):
	generated_at: datetime
	readiness_rules: list[AdminReadinessPolicyRule]
	readiness_tiers: list[AdminReadinessTier]
	verification_policies: list[AdminVerificationPolicy]
	jd_scoring_formula: str
	branch_policy_explanation: str
	centralized_configuration: bool = False
	policy_governance_notice: str

