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
	InstitutionalAnnouncement,
	PlacementDrive,
	RecruiterCompanyProfile,
	RecruiterJD,
	Student,
	StudentApplication,
	User,
)


def admin_phase3_client():
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
		recruiter = User(
			email="recruiter@example.com",
			hashed_password="recruiter-secret-hash",
			role="recruiter",
			is_active=True,
		)
		inactive_user = User(
			email="deactivated@example.com",
			hashed_password="inactive-secret-hash",
			role="student",
			is_active=False,
		)
		session.add_all([admin, student_user, recruiter, inactive_user])
		session.flush()

		student = Student(
			name="=CMD|' /C calc'!A0 Student",  # Untrusted text that tests CSV formula injection!
			email=student_user.email,
			branch="CSE",
			cgpa=8.5,
			skills="Python, SQL",
			university_roll_number="BPUT-999",
			onboarding_complete=True,
			documents_confirmed=False,  # Unconfirmed docs to trigger compliance warning
			college_id_verified=False,  # Unverified ID
		)
		drive = PlacementDrive(
			company_name="Acme Corp",
			drive_date=datetime(2026, 11, 15, 10, 0),
			venue="Main Auditorium",
			status="Scheduled",
		)
		jd = RecruiterJD(
			company_name="Acme Corp",
			role_title="Software Engineer",
			min_cgpa=7.5,
			required_skills="Python",
			package_lpa=12.0,
		)
		session.add_all([student, drive, jd])
		session.flush()

		app = StudentApplication(
			student_id=student.id,
			external_job_id=f"recruiter-jd-{jd.id}",
			job_title=jd.role_title,
			company_name=jd.company_name,
			job_url="https://example.com/apply",
			status="Applied",
		)
		notice = InstitutionalAnnouncement(
			title="Campus Drive Kickoff",
			message="All eligible final year students must register.",
			category="Placement",
			priority="High",
			published_at=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
			is_published=True,
			created_by="admin@example.com",
		)
		profile = RecruiterCompanyProfile(
			user_id=recruiter.id,
			company_name="Acme Corp",
			industry="Information Technology",
			location="Bhubaneswar",
			website="https://acme.example.com",
		)
		session.add_all([app, notice, profile])
		session.commit()

	def override_get_db():
		with Session(engine) as session:
			yield session

	fastapi_app = FastAPI()
	fastapi_app.include_router(admin_router, prefix="/api/v1")
	fastapi_app.dependency_overrides[get_db] = override_get_db
	return TestClient(fastapi_app), engine


def auth_headers(email: str, role: str) -> dict[str, str]:
	token = create_access_token(email=email, role=role)
	return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# Module 9 Tests: Announcements & Notices
# ==============================================================================

def test_announcements_endpoints_require_admin():
	client, engine = admin_phase3_client()
	try:
		# Unauthenticated -> 401
		assert client.get("/api/v1/admin/announcements").status_code == 401
		# Student role -> 403 Forbidden
		assert client.get(
			"/api/v1/admin/announcements",
			headers=auth_headers("student@example.com", "student"),
		).status_code == 403
	finally:
		client.close()
		engine.dispose()


def test_announcements_crud_and_filters():
	client, engine = admin_phase3_client()
	try:
		headers = auth_headers("admin@example.com", "admin")

		# 1. List existing
		res = client.get("/api/v1/admin/announcements", headers=headers)
		assert res.status_code == 200
		items = res.json()
		assert len(items) == 1
		assert items[0]["title"] == "Campus Drive Kickoff"
		assert items[0]["priority"] == "High"
		assert items[0]["is_published"] is True

		# 2. Create new announcement
		create_payload = {
			"title": "Semester Registration Deadline",
			"message": "Final date to confirm exam forms is approaching.",
			"category": "Academic",
			"priority": "Normal",
		}
		create_res = client.post("/api/v1/admin/announcements", json=create_payload, headers=headers)
		assert create_res.status_code == 201
		created = create_res.json()
		assert created["title"] == "Semester Registration Deadline"
		assert created["created_by"] == "admin@example.com"
		new_id = created["id"]

		# 3. Patch / Archive announcement
		patch_res = client.patch(
			f"/api/v1/admin/announcements/{new_id}",
			json={"is_published": False, "priority": "Low"},
			headers=headers,
		)
		assert patch_res.status_code == 200
		assert patch_res.json()["is_published"] is False
		assert patch_res.json()["priority"] == "Low"

		# 4. Filter by is_published
		active_res = client.get("/api/v1/admin/announcements?is_published=true", headers=headers)
		assert len(active_res.json()) == 1
		assert active_res.json()[0]["id"] != new_id

		# 5. Delete announcement
		del_res = client.delete(f"/api/v1/admin/announcements/{new_id}", headers=headers)
		assert del_res.status_code == 200

		# 6. Verify deleted
		res_after = client.get("/api/v1/admin/announcements", headers=headers)
		assert len(res_after.json()) == 1
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 10 Tests: Reports & Data Export
# ==============================================================================

def test_reports_summary_and_export():
	client, engine = admin_phase3_client()
	try:
		headers = auth_headers("admin@example.com", "admin")

		# 1. Summary
		sum_res = client.get("/api/v1/admin/reports/summary", headers=headers)
		assert sum_res.status_code == 200
		summary = sum_res.json()
		assert summary["students"] == 1
		assert summary["active_admins"] == 1
		assert summary["active_recruiters"] == 1
		assert summary["scheduled_drives"] == 1
		assert summary["open_applications"] == 1
		assert summary["inactive_accounts"] == 1
		assert summary["unverified_students"] == 1

		# 2. Export students CSV with Formula Injection Protection check
		export_res = client.get("/api/v1/admin/reports/export?dataset=students", headers=headers)
		assert export_res.status_code == 200
		data = export_res.json()
		assert "filename" in data
		assert data["filename"].startswith("campuslink_students_report_")
		content = data["content"]
		assert "Student ID,Full Name,Email Address" in content
		# Formula injection protection verification: '=CMD' MUST be escaped with a leading apostrophe
		assert "'=CMD|' /C calc'!A0 Student" in content
		# Passwords must NEVER be in export
		assert "secret" not in content
		assert "hash" not in content

		# 3. Export drives, applications, recruiters, announcements
		for ds in ("drives", "applications", "recruiters", "announcements"):
			resp = client.get(f"/api/v1/admin/reports/export?dataset={ds}", headers=headers)
			assert resp.status_code == 200
			assert resp.json()["filename"].startswith(f"campuslink_{ds}_report_")
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 11 Tests: Audit Logs & Security
# ==============================================================================

def test_audit_logs_summary_and_entries():
	client, engine = admin_phase3_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		res = client.get("/api/v1/admin/audit", headers=headers)
		assert res.status_code == 200
		audit = res.json()
		assert audit["active_admins"] >= 1
		assert audit["inactive_accounts"] >= 1
		assert audit["unverified_students"] >= 1
		assert len(audit["warnings"]) > 0
		assert len(audit["entries"]) > 0

		# Check severity filtering
		warn_res = client.get("/api/v1/admin/audit?severity=warning", headers=headers)
		assert warn_res.status_code == 200
		for e in warn_res.json()["entries"]:
			assert e["severity"] == "warning"

		# Check category filtering
		acc_res = client.get("/api/v1/admin/audit?category=Access", headers=headers)
		assert acc_res.status_code == 200
		for e in acc_res.json()["entries"]:
			assert "access" in e["category"].lower()
	finally:
		client.close()
		engine.dispose()


# ==============================================================================
# Module 12 Tests: System Settings & Integrations
# ==============================================================================

def test_settings_and_integrations_protection():
	client, engine = admin_phase3_client()
	try:
		headers = auth_headers("admin@example.com", "admin")

		# 1. Settings
		settings_res = client.get("/api/v1/admin/settings", headers=headers)
		assert settings_res.status_code == 200
		settings_data = settings_res.json()
		assert settings_data["organization_name"] == "BPUT Placement Network (CampusLink)"
		assert len(settings_data["settings"]) > 0
		# Strict Secret Protection Check: No sensitive credentials in response
		body_text = settings_res.text.lower()
		assert "jwt_secret_key" not in body_text
		assert "groq_api_key" not in body_text
		assert "password_hash" not in body_text
		assert "top-secret" not in body_text

		# 2. Integrations
		integ_res = client.get("/api/v1/admin/integrations", headers=headers)
		assert integ_res.status_code == 200
		integ_list = integ_res.json()
		assert len(integ_list) >= 3
		names = [i["name"] for i in integ_list]
		assert any("SQLite" in name for name in names)
		assert any("AI Placement" in name for name in names)
		assert any("Jobicy" in name for name in names)
	finally:
		client.close()
		engine.dispose()

