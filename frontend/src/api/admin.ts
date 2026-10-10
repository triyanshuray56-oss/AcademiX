import api from './http';

export type AdminUser = {
	id: number;
	email: string;
	role: 'student' | 'recruiter' | 'admin';
	is_active: boolean;
};

export type AdminStudent = {
	id: number;
	name: string;
	email: string;
	branch: string;
	university_roll_number: string | null;
	cgpa: number;
	active_backlogs: number;
	cleared_backlogs: number;
	skills: string;
	onboarding_complete: boolean;
	documents_confirmed: boolean;
	college_id_verified: boolean;
};

export type AdminRecruiter = {
	id: number;
	email: string;
	is_active: boolean;
	company_name: string | null;
	description: string | null;
	website: string | null;
	location: string | null;
	industry: string | null;
	job_posting_count: number | null;
};

export type AdminDriveStatus = 'Scheduled' | 'Completed' | 'Conflicted';
export type AdminEligibilityResult =
	| 'Meets recorded criteria'
	| 'Does not meet recorded criteria'
	| 'Requires review';

export type AdminEligibilityJob = {
	id: number;
	company_name: string;
	role_title: string;
	job_category: string;
	min_cgpa: number;
	required_skills: string;
	eligible_branches: string[] | null;
	application_deadline: string | null;
};

export type AdminPlacementDrive = {
	id: number;
	company_name: string;
	drive_date: string;
	registration_deadline: string | null;
	venue: string;
	status: AdminDriveStatus;
	conflicting_drive_ids: number[];
	recruiter_jobs: AdminEligibilityJob[];
};

export type AdminPlacementDriveDraft = Pick<
	AdminPlacementDrive,
	'company_name' | 'drive_date' | 'registration_deadline' | 'venue' | 'status'
>;

export type AdminApplication = {
	id: number;
	student_id: number;
	student_name: string;
	student_email: string;
	branch: string;
	cgpa: number;
	job_title: string;
	company_name: string;
	status: string;
	created_at: string;
	interviews: {
		id: number;
		interview_type: string;
		scheduled_at: string;
		duration_minutes: number;
		interviewer: string;
		status: string;
	}[];
	offers: {
		id: number;
		package_lpa: number;
		offer_date: string;
		joining_date: string | null;
		location: string | null;
		employment_type: string;
		offer_status: string;
		placement_status: string;
	}[];
};

export type AdminEligibilityStudent = {
	student_id: number;
	name: string;
	email: string;
	branch: string;
	cgpa: number;
	active_backlogs: number;
	cleared_backlogs: number;
	result: AdminEligibilityResult;
	reason: string;
	fit_score: number;
	matched_skills: string[];
	missing_skills: string[];
	documents_confirmed: boolean;
	college_id_verified: boolean;
	warnings: string[];
};

export type AdminEligibilityRole = AdminEligibilityJob & {
	students: AdminEligibilityStudent[];
};

export type AdminEligibilityReview = {
	target_type: 'drive' | 'job';
	target_id: number;
	target_label: string;
	roles: AdminEligibilityRole[];
	message: string | null;
};

export type AdminOrganization = {
	departments_available: boolean;
	department_message: string;
	branches: { name: string; student_count: number }[];
	unassigned_student_count: number;
};

export type AdminFilters = {
	search?: string;
	role?: string;
	is_active?: string;
	branch?: string;
	onboarding_complete?: string;
	status?: string;
	date_from?: string;
	date_to?: string;
};

function nonEmptyFilters(filters: AdminFilters): AdminFilters {
	const result: AdminFilters = {};
	for (const [key, value] of Object.entries(filters) as [keyof AdminFilters, string | undefined][]) {
		if (value) result[key] = value;
	}
	return result;
}

export async function fetchAdminUsers(filters: AdminFilters = {}) {
	const { data } = await api.get<AdminUser[]>('/v1/admin/users', { params: nonEmptyFilters(filters) });
	return data;
}

export async function updateAdminUser(
	userId: number,
	updates: Pick<AdminUser, 'role' | 'is_active'>,
) {
	const { data } = await api.patch<AdminUser>(`/v1/admin/users/${userId}`, updates);
	return data;
}

export async function fetchAdminStudents(filters: AdminFilters = {}) {
	const { data } = await api.get<AdminStudent[]>('/v1/admin/students', { params: nonEmptyFilters(filters) });
	return data;
}

export async function fetchAdminRecruiters(filters: AdminFilters = {}) {
	const { data } = await api.get<AdminRecruiter[]>('/v1/admin/recruiters', { params: nonEmptyFilters(filters) });
	return data;
}

export async function fetchAdminDrives(filters: AdminFilters = {}) {
	const { data } = await api.get<AdminPlacementDrive[]>('/v1/admin/drives', { params: nonEmptyFilters(filters) });
	return data;
}

export async function createAdminDrive(drive: AdminPlacementDriveDraft) {
	const { data } = await api.post<AdminPlacementDrive>('/v1/admin/drives', drive);
	return data;
}

export async function updateAdminDrive(driveId: number, updates: Partial<AdminPlacementDriveDraft>) {
	const { data } = await api.patch<AdminPlacementDrive>(`/v1/admin/drives/${driveId}`, updates);
	return data;
}

export async function fetchAdminApplications(filters: AdminFilters = {}) {
	const { data } = await api.get<AdminApplication[]>('/v1/admin/applications', { params: nonEmptyFilters(filters) });
	return data;
}

export async function fetchAdminApplication(applicationId: number) {
	const { data } = await api.get<AdminApplication>(`/v1/admin/applications/${applicationId}`);
	return data;
}

export async function fetchAdminEligibilityJobs(search = '') {
	const { data } = await api.get<AdminEligibilityJob[]>('/v1/admin/eligibility/jobs', {
		params: nonEmptyFilters({ search }),
	});
	return data;
}

export async function reviewAdminEligibility(
	target: { drive_id: number } | { job_id: number },
	filters: {
		search?: string;
		branch?: string;
		result?: AdminEligibilityResult | '';
		documents_confirmed?: string;
		college_id_verified?: string;
	} = {},
) {
	const { data } = await api.get<AdminEligibilityReview>('/v1/admin/eligibility', {
		params: { ...target, ...nonEmptyFilters(filters) },
	});
	return data;
}

export async function fetchAdminOrganization() {
	const { data } = await api.get<AdminOrganization>('/v1/admin/organization');
	return data;
}

// ==============================================================================
// Phase 3: Module 9 - Announcements & Notices
// ==============================================================================

export type AdminAnnouncement = {
	id: number;
	title: string;
	message: string;
	category: string;
	priority: 'Low' | 'Normal' | 'High';
	published_at: string;
	created_by: string | null;
	is_published: boolean;
};

export type AdminAnnouncementCreate = {
	title: string;
	message: string;
	category?: string;
	priority?: 'Low' | 'Normal' | 'High';
	published_at?: string | null;
};

export type AdminAnnouncementUpdate = {
	title?: string;
	message?: string;
	category?: string;
	priority?: 'Low' | 'Normal' | 'High';
	is_published?: boolean;
};

export async function fetchAdminAnnouncements(
	filters: { search?: string; category?: string; priority?: string; is_published?: string } = {},
) {
	const { data } = await api.get<AdminAnnouncement[]>('/v1/admin/announcements', {
		params: nonEmptyFilters(filters),
	});
	return data;
}

export async function createAdminAnnouncement(payload: AdminAnnouncementCreate) {
	const { data } = await api.post<AdminAnnouncement>('/v1/admin/announcements', payload);
	return data;
}

export async function updateAdminAnnouncement(id: number, payload: AdminAnnouncementUpdate) {
	const { data } = await api.patch<AdminAnnouncement>(`/v1/admin/announcements/${id}`, payload);
	return data;
}

export async function deleteAdminAnnouncement(id: number) {
	const { data } = await api.delete<{ detail: string }>(`/v1/admin/announcements/${id}`);
	return data;
}

// ==============================================================================
// Phase 3: Module 10 - Reports & Data Export
// ==============================================================================

export type AdminReportSummary = {
	generated_at: string;
	students: number;
	active_recruiters: number;
	active_admins: number;
	scheduled_drives: number;
	conflicted_drives: number;
	open_applications: number;
	published_announcements: number;
	unverified_students: number;
	inactive_accounts: number;
};

export type AdminReportExport = {
	filename: string;
	content: string;
	media_type: string;
};

export async function fetchAdminReportSummary() {
	const { data } = await api.get<AdminReportSummary>('/v1/admin/reports/summary');
	return data;
}

export async function exportAdminReport(params: {
	dataset: 'students' | 'drives' | 'applications' | 'recruiters' | 'announcements';
	search?: string;
	branch?: string;
	status?: string;
}) {
	const { data } = await api.get<AdminReportExport>('/v1/admin/reports/export', {
		params: nonEmptyFilters(params),
	});
	return data;
}

// ==============================================================================
// Phase 3: Module 11 - Audit Logs & Security
// ==============================================================================

export type AdminAuditEntry = {
	category: string;
	label: string;
	detail: string;
	severity: 'info' | 'warning' | 'critical';
	recorded_at: string;
};

export type AdminAuditSummary = {
	generated_at: string;
	security_status: string;
	active_admins: number;
	inactive_accounts: number;
	unverified_students: number;
	conflicted_drives: number;
	warnings: string[];
	entries: AdminAuditEntry[];
};

export async function fetchAdminAuditLogs(filters: { category?: string; severity?: string } = {}) {
	const { data } = await api.get<AdminAuditSummary>('/v1/admin/audit', {
		params: nonEmptyFilters(filters),
	});
	return data;
}

// ==============================================================================
// Phase 3: Module 12 - System Settings & Integrations
// ==============================================================================

export type AdminSetting = {
	key: string;
	label: string;
	value: string | boolean | number | string[];
	updated_at: string | null;
};

export type AdminSettings = {
	organization_name: string;
	announcement_channels: string[];
	email_notifications_enabled: boolean;
	export_formats: string[];
	require_admin_approval_for_role_changes: boolean;
	settings: AdminSetting[];
};

export type AdminIntegrationStatus = {
	name: string;
	status: 'online' | 'degraded' | 'offline';
	detail: string;
};

export async function fetchAdminSettings() {
	const { data } = await api.get<AdminSettings>('/v1/admin/settings');
	return data;
}

export async function fetchAdminIntegrations() {
	const { data } = await api.get<AdminIntegrationStatus[]>('/v1/admin/integrations');
	return data;
}

// ==============================================================================
// ==============================================================================
// Phase 4: Module 13 - Attendance & Assessment Oversight
// ==============================================================================

export type AdminDriveAttendance = {
	drive_id: number;
	company_name: string;
	drive_date: string;
	venue: string;
	status: string;
	panel_throughput_rate: number | null;
};

export type AdminAssessmentSession = {
	session_id: string;
	student_id: number;
	student_name: string;
	student_email: string;
	assessment_id: string;
	current_strikes: number;
	trust_score: number;
	mobile_connected: boolean;
	auto_submit_triggered: boolean;
	last_ping: string;
	created_at: string;
	closed_at: string | null;
	status: string;
};

export type AdminAssessmentViolation = {
	id: number;
	session_id: string;
	event_type: string;
	timestamp: string;
	strike_count: number;
};

export type AdminOversightSummary = {
	generated_at: string;
	total_assessment_sessions: number;
	flagged_sessions: number;
	average_trust_score: number;
	total_violations: number;
	active_drive_sessions: number;
	sessions: AdminAssessmentSession[];
	violations: AdminAssessmentViolation[];
	drives: AdminDriveAttendance[];
};

export type AdminAttendanceAssessmentOversight = AdminOversightSummary;
export type AdminAttendanceSession = AdminDriveAttendance;
export type AdminAssessmentSessionSummary = AdminAssessmentSession;
export type AdminAssessmentViolationSummary = AdminAssessmentViolation;

export async function fetchAdminOversight(filters: { search?: string; status?: string; assessment_id?: string } = {}) {
	const { data } = await api.get<AdminOversightSummary>('/v1/admin/oversight/attendance-assessments', {
		params: nonEmptyFilters(filters),
	});
	return data;
}

// ==============================================================================
// Phase 4: Module 14 - Grievances & Support Requests
// ==============================================================================

export type AdminGrievanceItem = {
	id: number;
	requester_email: string;
	requester_name: string;
	category: string;
	subject: string;
	message: string;
	status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
	created_at: string;
	updated_at: string;
	assigned_to: string | null;
	resolution_note: string | null;
};

export type AdminGrievanceStatusUpdate = {
	status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
	resolution_note?: string;
};

export async function fetchAdminGrievances(filters: { search?: string; status?: string; category?: string } = {}) {
	const { data } = await api.get<AdminGrievanceItem[]>('/v1/admin/grievances', {
		params: nonEmptyFilters(filters),
	});
	return data;
}

export async function updateAdminGrievance(id: number, payload: AdminGrievanceStatusUpdate) {
	const { data } = await api.patch<AdminGrievanceItem>(`/v1/admin/grievances/${id}`, payload);
	return data;
}

// ==============================================================================
// Phase 4: Module 15 - Data Quality & Import Management
// ==============================================================================

export type AdminImportRowError = {
	row_number: number;
	field: string;
	message: string;
	invalid_value?: string | null;
};

export type AdminImportPreview = {
	total_rows: number;
	valid_count: number;
	invalid_count: number;
	duplicate_count: number;
	supported_entity: string;
	errors: AdminImportRowError[];
	preview_rows: Record<string, unknown>[];
};

export type AdminImportCommitResult = {
	success: boolean;
	imported_count: number;
	skipped_count: number;
	failed_count: number;
	message: string;
};

export async function previewAdminImport(csv_content: string) {
	const { data } = await api.post<AdminImportPreview>('/v1/admin/imports/preview', { csv_content });
	return data;
}

export async function commitAdminImport(csv_content: string) {
	const { data } = await api.post<AdminImportCommitResult>('/v1/admin/imports/commit', { csv_content });
	return data;
}

// ==============================================================================
// Phase 4: Module 16 - Backup & Recovery Management
// ==============================================================================

export type AdminBackupArtifact = {
	filename: string;
	path: string;
	size_bytes: number;
	created_at: string;
};

export type AdminDatabaseStatus = {
	database_path: string;
	database_size_bytes: number;
	last_modified: string;
	wal_mode_enabled: boolean;
	is_read_only: boolean;
	record_counts: Record<string, number>;
	available_backups: AdminBackupArtifact[];
	safety_disclaimer: string;
};

export type AdminSnapshotResult = {
	success: boolean;
	filename: string;
	size_bytes: number;
	created_at: string;
	message: string;
};

export async function fetchAdminDatabaseStatus() {
	const { data } = await api.get<AdminDatabaseStatus>('/v1/admin/backups');
	return data;
}

export async function createAdminSnapshot() {
	const { data } = await api.post<AdminSnapshotResult>('/v1/admin/backups/snapshot');
	return data;
}

// ==============================================================================
// Phase 4: Module 17 - Notification & Delivery Monitoring
// ==============================================================================

export type AdminNotificationItem = {
	id: string;
	channel: string;
	recipient_group: string;
	title: string;
	status: 'delivered' | 'pending' | 'not_configured';
	timestamp: string;
	delivery_detail: string;
};

export type AdminNotificationDeliverySummary = {
	total_in_app_notices: number;
	in_app_active_count: number;
	external_configured: boolean;
	external_delivery_notice: string;
	recent_notifications: AdminNotificationItem[];
};

export async function fetchAdminNotificationMonitoring() {
	const { data } = await api.get<AdminNotificationDeliverySummary>('/v1/admin/notifications/monitoring');
	return data;
}

// ==============================================================================
// Phase 4: Module 18 - Policy & Eligibility Rules
// ==============================================================================

export type AdminReadinessPolicyRule = {
	name: string;
	weight_percent: number;
	formula: string;
	description: string;
};

export type AdminReadinessTier = {
	tier_name: string;
	score_range: string;
	description: string;
	current_student_count: number;
};

export type AdminVerificationPolicy = {
	rule_name: string;
	required: boolean;
	criteria_field: string;
	description: string;
	compliant_student_count: number;
	pending_student_count: number;
};

export type AdminEligibilityPolicies = {
	generated_at: string;
	readiness_rules: AdminReadinessPolicyRule[];
	readiness_tiers: AdminReadinessTier[];
	verification_policies: AdminVerificationPolicy[];
	jd_scoring_formula: string;
	branch_policy_explanation: string;
	centralized_configuration: boolean;
	policy_governance_notice: string;
};

export async function fetchAdminEligibilityPolicies() {
	const { data } = await api.get<AdminEligibilityPolicies>('/v1/admin/policies/eligibility');
	return data;
}


