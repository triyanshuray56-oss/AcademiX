from datetime import datetime, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.admin import router as admin_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import (
	AssessmentProctoringSession,
	AssessmentViolation,
	CandidateConnection,
	DirectMessage,
	Drive,
	PlacementDrive,
	Student,
	User,
)


def admin_phase4_client():
	engine = create_engine(
		"sqlite://",
		connect_args={"check_same_thread": False},
		poolclass=StaticPool,
	)
	Base.metadata.create_all(engine)
	with Session(engine) as session:
		admin = User(
			email="admin@example.com",
			hashed_password="top-secret-password-hash",
			role="admin",
			is_active=True,
		)
		student_user = User(
			email="student@example.com",
			hashed_password="student-secret-hash",
			role="student",
			is_active=True,
		)
		session.add_all([admin, student_user])
		session.flush()

		student = Student(
			name="Jane Doe",
			email=student_user.email,
			branch="CSE",
			cgpa=8.8,
			skills="Python, SQL",
			university_roll_number="BPUT-101",
			onboarding_complete=True,
			documents_confirmed=True,
			college_id_verified=True,
		)
		session.add(student)
		session.flush()

		p_session = AssessmentProctoringSession(
			session_id="sess_12345",
			student_id=student.id,
			assessment_id="quiz_algo_101",
			current_strikes=1,
			trust_score=85.0,
			mobile_connected=True,
			last_ping=datetime.now(timezone.utc),
			created_at=datetime.now(timezone.utc),
			auto_submit_triggered=False,
		)
		session.add(p_session)
		session.flush()

		violation = AssessmentViolation(
			session_id=p_session.session_id,
			event_type="multiple_faces_detected",
			timestamp=datetime.now(timezone.utc),
			strike_count=1,
		)
		conn = CandidateConnection(
			sender_id=admin.id,
			recipient_id=student_user.id,
			sender_role="admin",
			opportunity_title="Exam Venue Query",
			intro_message="Please confirm the exam room for the placement drive.",
			status="pending",
			created_at=datetime.now(timezone.utc),
		)
		drive = PlacementDrive(
			company_name="Apex Global",
			drive_date=datetime(2026, 11, 20, 10, 0),
			venue="Tech Park Audi",
			status="Scheduled",
		)
		session.add_all([violation, conn, drive])
		session.commit()

	def override_get_db():
		with Session(engine) as session:
			yield session

	app = FastAPI()
	app.include_router(admin_router, prefix="/api/v1")
	app.dependency_overrides[get_db] = override_get_db
	return TestClient(app), engine


def auth_headers(email: str, role: str) -> dict[str, str]:
	token = create_access_token(email=email, role=role)
	return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# Module 13: Attendance & Assessment Oversight Tests
# ==============================================================================

def test_attendance_assessment_oversight():
	client, engine = admin_phase4_client()
	try:
		# Unauthenticated -> 401
		assert client.get("/api/v1/admin/oversight/attendance-assessments").status_code == 401
		# Student -> 403
		assert client.get(
			"/api/v1/admin/oversight/attendance-assessments",
			headers=auth_headers("student@example.com", "student"),
		).status_code == 403

		# Admin -> 200
		res = client.get(
			"/api/v1/admin/oversight/attendance-assessments",
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert res.status_code == 200
		data = res.json()
		assert data["total_assessment_sessions"] == 1
		assert data["flagged_sessions"] == 1
		assert data["total_violations"] == 1
		assert len(data["sessions"]) == 1
		assert data["sessions"][0]["session_id"] == "sess_12345"
		assert data["sessions"][0]["student_name"] == "Jane Doe"
		assert len(data["violations"]) == 1
		assert data["violations"][0]["event_type"] == "multiple_faces_detected"
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 14: Grievances & Support Requests Tests
# ==============================================================================

def test_grievances_list_and_update():
	client, engine = admin_phase4_client()
	try:
		headers = auth_headers("admin@example.com", "admin")

		# 1. List
		res = client.get("/api/v1/admin/grievances", headers=headers)
		assert res.status_code == 200
		items = res.json()
		assert len(items) == 1
		assert items[0]["requester_email"] == "student@example.com"
		assert items[0]["subject"] == "Exam Venue Query"
		assert items[0]["status"] == "pending"

		thread_id = items[0]["id"]

		# 2. Update status to resolved
		patch_res = client.patch(
			f"/api/v1/admin/grievances/{thread_id}",
			json={"status": "resolved", "resolution_note": "Venue confirmed as Audi 2"},
			headers=headers,
		)
		assert patch_res.status_code == 200
		assert patch_res.json()["status"] == "resolved"
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 15: Data Quality & Import Management Tests
# ==============================================================================

def test_student_csv_import_preview_and_commit():
	client, engine = admin_phase4_client()
	try:
		headers = auth_headers("admin@example.com", "admin")

		csv_data = (
			"Name,Email,Branch,CGPA,Roll Number,Backlogs,Skills\n"
			"John Doe,john.doe@example.com,ECE,8.2,BPUT-201,0,C++, Embedded\n"
			"Invalid Student,bad-email,MECH,12.5,BPUT-202,-1,CAD\n"
			"Duplicate Student,student@example.com,CSE,7.5,BPUT-101,0,Java\n"
		)

		# 1. Preview
		prev_res = client.post(
			"/api/v1/admin/imports/preview",
			json={"confirm": True, "csv_content": csv_data},
			headers=headers,
		)
		assert prev_res.status_code == 200
		prev = prev_res.json()
		assert prev["total_rows"] == 3
		assert prev["valid_count"] == 1
		assert prev["invalid_count"] == 1  # bad email and out of range CGPA
		assert prev["duplicate_count"] == 1  # student@example.com already exists in DB
		assert len(prev["errors"]) > 0

		# 2. Commit without confirm -> 400
		no_conf = client.post(
			"/api/v1/admin/imports/commit",
			json={"confirm": False, "csv_content": csv_data},
			headers=headers,
		)
		assert no_conf.status_code == 400

		# 3. Commit with confirm -> 200
		commit_res = client.post(
			"/api/v1/admin/imports/commit",
			json={"confirm": True, "csv_content": csv_data},
			headers=headers,
		)
		assert commit_res.status_code == 200
		res_json = commit_res.json()
		assert res_json["success"] is True
		assert res_json["imported_count"] == 1
		assert res_json["skipped_count"] == 1
		assert res_json["failed_count"] == 1
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 16: Backup & Recovery Management Tests
# ==============================================================================

def test_backup_and_recovery_status():
	client, engine = admin_phase4_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		res = client.get("/api/v1/admin/backups", headers=headers)
		assert res.status_code == 200
		b_data = res.json()
		assert b_data["database_type"] == "SQLite 3.x"
		assert b_data["database_path"] == "campuslink.db"
		assert b_data["restore_enabled"] is False  # Safety check
		assert len(b_data["safe_instructions"]) >= 3
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 17: Notification & Delivery Monitoring Tests
# ==============================================================================

def test_notification_monitoring_status():
	client, engine = admin_phase4_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		res = client.get("/api/v1/admin/notifications/monitoring", headers=headers)
		assert res.status_code == 200
		data = res.json()
		assert data["external_configured"] is False
		channel_names = [c["channel_name"] for c in data["channels"]]
		assert "In-App Institutional Notices" in channel_names
		assert "External Email (SMTP)" in channel_names
		# Verify SMTP channel is marked not_configured truthfully
		smtp_ch = next(c for c in data["channels"] if "Email" in c["channel_name"])
		assert smtp_ch["status"] == "not_configured"
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 18: Policy & Eligibility Rules Tests
# ==============================================================================

def test_eligibility_policy_inspection():
	client, engine = admin_phase4_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		res = client.get("/api/v1/admin/policies/eligibility", headers=headers)
		assert res.status_code == 200
		pol = res.json()
		assert len(pol["readiness_rules"]) == 3
		assert len(pol["readiness_tiers"]) == 4
		assert len(pol["verification_policies"]) == 2
		assert pol["centralized_configuration"] is False
		# Readiness weights must sum to 100%
		total_weight = sum(r["weight_percent"] for r in pol["readiness_rules"])
		assert total_weight == 100
	finally:
		client.close()
		engine.dispose()
