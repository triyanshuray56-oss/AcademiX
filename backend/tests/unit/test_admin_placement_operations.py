import json
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.admin import router as admin_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import (
	PlacementDrive,
	RecruiterInterview,
	RecruiterJD,
	RecruiterOffer,
	Student,
	StudentApplication,
	User,
)


def admin_operations_client():
	engine = create_engine(
		"sqlite://",
		connect_args={"check_same_thread": False},
		poolclass=StaticPool,
	)
	Base.metadata.create_all(engine)
	with Session(engine) as session:
		admin = User(
			email="admin@example.com",
			hashed_password="admin-secret",
			role="admin",
			is_active=True,
		)
		student_user = User(
			email="student@example.com",
			hashed_password="student-secret",
			role="student",
			is_active=True,
		)
		session.add_all([admin, student_user])
		session.flush()
		session.add(
			Student(
				name="Casey Student",
				email=student_user.email,
				branch="CSE",
				cgpa=8.2,
				skills="Python, SQL",
				active_backlogs=0,
				cleared_backlogs=1,
				documents_confirmed=True,
				college_id_verified=True,
			)
		)
		session.add(
			RecruiterJD(
				company_name="Example Systems",
				role_title="Software Engineer",
				min_cgpa=7.0,
				required_skills="Python, SQL",
				package_lpa=8.0,
				eligible_branches=json.dumps(["CSE"]),
			)
		)
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


def future_datetime(days: int = 20) -> datetime:
	return (datetime.now() + timedelta(days=days)).replace(second=0, microsecond=0)


def test_placement_operations_require_admin_authentication():
	client, engine = admin_operations_client()
	try:
		assert client.get("/api/v1/admin/drives").status_code == 401
		assert client.get(
			"/api/v1/admin/applications",
			headers=auth_headers("student@example.com", "student"),
		).status_code == 403
		assert client.get(
			"/api/v1/admin/eligibility/jobs",
			headers=auth_headers("student@example.com", "student"),
		).status_code == 403
		assert client.post(
			"/api/v1/admin/drives",
			headers=auth_headers("student@example.com", "student"),
			json={
				"company_name": "Unauthorized Co",
				"drive_date": future_datetime().isoformat(),
				"venue": "Hall B",
			},
		).status_code == 403
	finally:
		client.close()
		engine.dispose()


def test_admin_drive_listing_includes_real_job_criteria_and_supports_filters():
	client, engine = admin_operations_client()
	try:
		with Session(engine) as session:
			session.add(
				PlacementDrive(
					company_name="Example Systems",
					drive_date=future_datetime(),
					registration_deadline=future_datetime(-2),
					venue="Placement Hall",
					status="Scheduled",
				)
			)
			session.commit()

		response = client.get(
			"/api/v1/admin/drives",
			params={"search": "Example", "status": "Scheduled"},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		drive = response.json()[0]
		assert drive["company_name"] == "Example Systems"
		assert drive["recruiter_jobs"][0]["role_title"] == "Software Engineer"
		assert drive["recruiter_jobs"][0]["eligible_branches"] == ["CSE"]
		assert drive["conflicting_drive_ids"] == []
	finally:
		client.close()
		engine.dispose()


def test_admin_drive_create_validates_deadline_and_persists_valid_records():
	client, engine = admin_operations_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		drive_date = future_datetime(10)
		late_deadline = client.post(
			"/api/v1/admin/drives",
			headers=headers,
			json={
				"company_name": "Example Systems",
				"drive_date": drive_date.isoformat(),
				"registration_deadline": future_datetime(12).isoformat(),
				"venue": "Placement Hall",
			},
		)
		assert late_deadline.status_code == 422

		created = client.post(
			"/api/v1/admin/drives",
			headers=headers,
			json={
				"company_name": "Example Systems",
				"drive_date": drive_date.isoformat(),
				"registration_deadline": future_datetime(8).isoformat(),
				"venue": "Placement Hall",
			},
		)
		assert created.status_code == 201
		assert created.json()["status"] == "Scheduled"
		assert created.json()["recruiter_jobs"][0]["id"] == 1

		with Session(engine) as session:
			assert session.scalar(select(func.count(PlacementDrive.id))) == 1
	finally:
		client.close()
		engine.dispose()


def test_admin_drive_create_and_update_reject_new_schedule_conflicts():
	client, engine = admin_operations_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		drive_date = future_datetime(15)
		with Session(engine) as session:
			session.add(
				PlacementDrive(
					company_name="Existing Co",
					drive_date=drive_date,
					venue="Hall One",
					status="Scheduled",
				)
			)
			session.add(
				PlacementDrive(
					company_name="Second Co",
					drive_date=future_datetime(16),
					venue="Hall Two",
					status="Scheduled",
				)
			)
			session.commit()

		conflicting_create = client.post(
			"/api/v1/admin/drives",
			headers=headers,
			json={
				"company_name": "New Co",
				"drive_date": drive_date.isoformat(),
				"venue": "Hall Three",
			},
		)
		assert conflicting_create.status_code == 409
		assert "1" in conflicting_create.json()["detail"]

		conflicting_update = client.patch(
			"/api/v1/admin/drives/2",
			headers=headers,
			json={"drive_date": drive_date.isoformat()},
		)
		assert conflicting_update.status_code == 409
		with Session(engine) as session:
			assert session.get(PlacementDrive, 2).drive_date == future_datetime(16)
			assert session.scalar(select(func.count(PlacementDrive.id))) == 2
	finally:
		client.close()
		engine.dispose()


def test_admin_application_detail_links_actual_interviews_and_offers_without_private_fields():
	client, engine = admin_operations_client()
	try:
		with Session(engine) as session:
			student = session.scalar(select(Student).where(Student.email == "student@example.com"))
			application = StudentApplication(
				student_id=student.id,
				external_job_id="recruiter-jd-1",
				job_title="Software Engineer",
				company_name="Example Systems",
				job_url="https://example.com/jobs/1",
				status="Shortlisted",
			)
			session.add(application)
			session.flush()
			session.add(
				RecruiterInterview(
					application_id=application.id,
					interview_type="Technical",
					scheduled_at=future_datetime(2),
					duration_minutes=60,
					interviewer="Interviewer",
					meeting_link="https://private.example.com/meeting",
					notes="Private interviewer notes",
					status="Scheduled",
				)
			)
			session.add(
				RecruiterOffer(
					application_id=application.id,
					package_lpa=8.0,
					offer_date=datetime.now(),
					employment_type="job",
					notes="Private offer notes",
					offer_status="Accepted",
					placement_status="Not Confirmed",
				)
			)
			session.commit()

		response = client.get(
			"/api/v1/admin/applications",
			params={"search": "Casey", "branch": "CSE", "status": "Shortlisted"},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		application = response.json()[0]
		assert application["status"] == "Shortlisted"
		assert application["interviews"][0]["status"] == "Scheduled"
		assert application["offers"][0]["offer_status"] == "Accepted"
		assert application["offers"][0]["placement_status"] == "Not Confirmed"
		assert "meeting_link" not in response.text
		assert "Private interviewer notes" not in response.text
		assert "Private offer notes" not in response.text
		assert "job_url" not in response.text

		detail = client.get(
			f"/api/v1/admin/applications/{application['id']}",
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert detail.status_code == 200
		assert detail.json()["student_email"] == "student@example.com"
	finally:
		client.close()
		engine.dispose()


def test_admin_eligibility_reuses_recorded_job_rules_and_exposes_verification_warnings():
	client, engine = admin_operations_client()
	try:
		with Session(engine) as session:
			session.add(
				Student(
					name="Taylor Student",
					email="taylor@example.com",
					branch="ECE",
					cgpa=9.2,
					skills="Python",
					documents_confirmed=False,
					college_id_verified=False,
				)
			)
			session.commit()

		response = client.get(
			"/api/v1/admin/eligibility",
			params={"job_id": 1},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		results = {row["email"]: row for row in response.json()["roles"][0]["students"]}
		assert results["student@example.com"]["result"] == "Meets recorded criteria"
		assert results["student@example.com"]["fit_score"] > 0
		assert results["taylor@example.com"]["result"] == "Does not meet recorded criteria"
		assert any("College ID" in warning for warning in results["taylor@example.com"]["warnings"])
		assert any("documents" in warning for warning in results["taylor@example.com"]["warnings"])
		assert client.get(
			"/api/v1/admin/eligibility",
			headers=auth_headers("admin@example.com", "admin"),
		).status_code == 422
	finally:
		client.close()
		engine.dispose()


def test_admin_eligibility_requires_review_for_invalid_branch_requirements():
	client, engine = admin_operations_client()
	try:
		with Session(engine) as session:
			job = session.get(RecruiterJD, 1)
			job.eligible_branches = "not-valid-json"
			session.commit()

		response = client.get(
			"/api/v1/admin/eligibility",
			params={"job_id": 1},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		student = response.json()["roles"][0]["students"][0]
		assert student["result"] == "Requires review"
		assert any("manual review" in warning for warning in student["warnings"])
	finally:
		client.close()
		engine.dispose()


def test_organization_page_reports_only_real_student_branch_usage():
	client, engine = admin_operations_client()
	try:
		response = client.get(
			"/api/v1/admin/organization",
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		assert response.json()["departments_available"] is False
		assert response.json()["branches"] == [{"name": "CSE", "student_count": 1}]
		assert "read-only labels" in response.json()["department_message"]
	finally:
		client.close()
		engine.dispose()
