from datetime import datetime, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from unittest.mock import AsyncMock, patch

from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.notices import router as notices_router
from backend.app.api.v1.recruiter_notices import router as recruiter_notices_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import (
	InstitutionalAnnouncement,
	PlacementDrive,
	RecruiterCompanyProfile,
	RecruiterJD,
	User,
)


@pytest.fixture
def student_notices_client():
	engine = create_engine(
		"sqlite://",
		connect_args={"check_same_thread": False},
		poolclass=StaticPool,
	)
	Base.metadata.create_all(engine)
	with Session(engine) as session:
		admin = User(
			email="admin@campuslink.internal",
			hashed_password="hashed_admin_pass",
			role="admin",
			is_active=True,
		)
		recruiter = User(
			email="hr@techcorp.com",
			hashed_password="hashed_recruiter_pass",
			role="recruiter",
			is_active=True,
		)
		student = User(
			email="student@campuslink.internal",
			hashed_password="hashed_student_pass",
			role="student",
			is_active=True,
		)
		session.add_all([admin, recruiter, student])
		session.flush()

		profile = RecruiterCompanyProfile(
			user_id=recruiter.id,
			company_name="TechCorp Solutions",
			description="Enterprise software provider",
			website="https://techcorp.example.com",
			logo_url="https://techcorp.example.com/logo.png",
		)
		session.add(profile)

		# 1. Admin Published Announcement
		admin_notice = InstitutionalAnnouncement(
			title="Semester 8 Placement Registration Open",
			message="All final-year students must verify their college IDs before Friday.",
			category="Academic Schedule",
			priority="High",
			published_at=datetime.now(timezone.utc),
			is_published=True,
			created_by=admin.email,
		)

		# 2. Admin Unpublished Announcement
		admin_draft = InstitutionalAnnouncement(
			title="Internal Draft Notice",
			message="Draft content not ready for student distribution.",
			category="Internal",
			priority="Low",
			published_at=datetime.now(timezone.utc),
			is_published=False,
			created_by=admin.email,
		)

		# 3. Recruiter Published Notice
		recruiter_notice = InstitutionalAnnouncement(
			title="TechCorp Graduate Engineer Trainee Walk-in",
			message="TechCorp is hiring GET candidates from CSE and ECE branches.",
			category="Job Posting",
			priority="Normal",
			published_at=datetime.now(timezone.utc),
			is_published=True,
			created_by=recruiter.email,
		)

		# 4. Recruiter Unpublished Notice
		recruiter_draft = InstitutionalAnnouncement(
			title="TechCorp Unapproved Position",
			message="Draft recruiter posting.",
			category="Job Posting",
			priority="Low",
			published_at=datetime.now(timezone.utc),
			is_published=False,
			created_by=recruiter.email,
		)

		session.add_all([admin_notice, admin_draft, recruiter_notice, recruiter_draft])
		session.commit()

	def override_get_db():
		with Session(engine) as session:
			yield session

	app = FastAPI()
	app.include_router(notices_router, prefix="/api/v1")
	app.include_router(recruiter_notices_router, prefix="/api/v1")
	app.include_router(admin_router, prefix="/api/v1")
	app.dependency_overrides[get_db] = override_get_db

	with TestClient(app) as client:
		yield client
	engine.dispose()


def auth_headers(email: str, role: str) -> dict[str, str]:
	token = create_access_token(email=email, role=role)
	return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# Subsection B: Admin Announcements Tests
# ==============================================================================

def test_authorized_student_can_retrieve_published_admin_announcements(student_notices_client: TestClient):
	client = student_notices_client
	headers = auth_headers("student@campuslink.internal", "student")

	res = client.get("/api/v1/notices/admin", headers=headers)
	assert res.status_code == 200
	data = res.json()

	assert len(data) == 1
	notice = data[0]
	assert notice["title"] == "Semester 8 Placement Registration Open"
	assert notice["category"] == "Academic Schedule"
	assert notice["priority"] == "High"
	assert notice["publisher"] == "Placement Cell Administration"
	# Ensure draft is excluded
	assert all(n["title"] != "Internal Draft Notice" for n in data)
	# Ensure recruiter notices are excluded
	assert all("TechCorp" not in n["title"] for n in data)
	# Ensure sensitive fields are not exposed
	assert "created_by" not in notice
	assert "hashed_password" not in notice


def test_unauthenticated_request_to_admin_notices_rejected(student_notices_client: TestClient):
	client = student_notices_client
	res = client.get("/api/v1/notices/admin")
	assert res.status_code == 401


# ==============================================================================
# Subsection C: Recruiter / HR Announcements Tests
# ==============================================================================

def test_authorized_student_can_retrieve_published_recruiter_announcements(student_notices_client: TestClient):
	client = student_notices_client
	headers = auth_headers("student@campuslink.internal", "student")

	res = client.get("/api/v1/notices/recruiter", headers=headers)
	assert res.status_code == 200
	data = res.json()

	assert len(data) == 1
	notice = data[0]
	assert notice["title"] == "TechCorp Graduate Engineer Trainee Walk-in"
	assert notice["company_name"] == "TechCorp Solutions"
	assert notice["logo_url"] == "https://techcorp.example.com/logo.png"
	assert notice["direct_link"] == "/student/jobs?company=TechCorp%20Solutions"
	# Ensure draft is excluded
	assert all(n["title"] != "TechCorp Unapproved Position" for n in data)
	# Ensure admin notices are excluded
	assert all("Semester 8" not in n["title"] for n in data)
	# Ensure sensitive fields are not exposed
	assert "created_by" not in notice


def test_unauthenticated_request_to_recruiter_notices_rejected(student_notices_client: TestClient):
	client = student_notices_client
	res = client.get("/api/v1/notices/recruiter")
	assert res.status_code == 401


# ==============================================================================
# Critical Separation of Permissions Tests
# ==============================================================================

def test_student_cannot_call_admin_announcement_management_endpoints(student_notices_client: TestClient):
	client = student_notices_client
	headers = auth_headers("student@campuslink.internal", "student")

	# Cannot create admin announcement
	post_res = client.post(
		"/api/v1/admin/announcements",
		headers=headers,
		json={"title": "Unauthorized Admin Announcement", "message": "Test"},
	)
	assert post_res.status_code == 403

	# Cannot list through admin management endpoint
	get_res = client.get("/api/v1/admin/announcements", headers=headers)
	assert get_res.status_code == 403


def test_student_cannot_call_recruiter_notice_management_endpoints(student_notices_client: TestClient):
	client = student_notices_client
	headers = auth_headers("student@campuslink.internal", "student")

	# Cannot create recruiter notice
	post_res = client.post(
		"/api/v1/recruiter-notices",
		headers=headers,
		json={"title": "Unauthorized Recruiter Notice", "message": "Test"},
	)
	assert post_res.status_code == 403

	# Cannot list through recruiter management endpoint
	get_res = client.get("/api/v1/recruiter-notices", headers=headers)
	assert get_res.status_code == 403


# ==============================================================================
# Backward Compatibility of Existing Placement Feed
# ==============================================================================

def test_existing_placement_announcements_feed_preserved(student_notices_client: TestClient):
	client = student_notices_client

	with (
		patch(
			"backend.app.api.v1.notices.get_active_job_feed",
			return_value=([], None),
		),
		patch(
			"backend.app.api.v1.notices.fetch_jobicy_jobs",
			new=AsyncMock(return_value=[]),
		),
	):
		res = client.get("/api/v1/notices/announcements")

	assert res.status_code == 200
	data = res.json()
	# The existing placement feed combines all published notices
	assert len(data) >= 2
	titles = [item["title"] for item in data]
	assert "Semester 8 Placement Registration Open" in titles
	assert "TechCorp Graduate Engineer Trainee Walk-in" in titles

