from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.admin import router as admin_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import RecruiterCompanyProfile, RecruiterJD, Student, User


def admin_core_client():
	engine = create_engine(
		"sqlite://",
		connect_args={"check_same_thread": False},
		poolclass=StaticPool,
	)
	Base.metadata.create_all(engine)
	with Session(engine) as session:
		admin = User(
			email="admin@example.com",
			hashed_password="never-return-this",
			role="admin",
			is_active=True,
		)
		student_user = User(
			email="student@example.com",
			hashed_password="student-secret",
			role="student",
			is_active=True,
		)
		recruiter = User(
			email="recruiter@example.com",
			hashed_password="recruiter-secret",
			role="recruiter",
			is_active=True,
		)
		session.add_all([admin, student_user, recruiter])
		session.flush()
		session.add_all([
			Student(
				name="Student Example",
				email=student_user.email,
				branch="CSE",
				cgpa=8.2,
				skills="Python, SQL",
				university_roll_number="BPUT-001",
				onboarding_complete=True,
				college_id_verified=True,
			),
			RecruiterCompanyProfile(
				user_id=recruiter.id,
				company_name="Example Systems",
				description="Software services",
				website="https://example.com",
				location="Bhubaneswar",
				industry="Software",
			),
			RecruiterJD(
				company_name="Example Systems",
				role_title="Engineer",
				min_cgpa=7.0,
				required_skills="Python",
				package_lpa=8.0,
			),
		])
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


def test_admin_endpoints_require_admin_role():
	client, engine = admin_core_client()
	try:
		assert client.get("/api/v1/admin/users").status_code == 401
		response = client.get(
			"/api/v1/admin/users",
			headers=auth_headers("student@example.com", "student"),
		)
		assert response.status_code == 403
	finally:
		client.close()
		engine.dispose()


def test_admin_user_list_filters_and_never_returns_credentials():
	client, engine = admin_core_client()
	try:
		response = client.get(
			"/api/v1/admin/users",
			params={"search": "student", "role": "student", "is_active": "true"},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		assert response.json() == [{
			"id": 2,
			"email": "student@example.com",
			"role": "student",
			"is_active": True,
		}]
		assert "hashed_password" not in response.text
		assert "student-secret" not in response.text
	finally:
		client.close()
		engine.dispose()


def test_admin_account_updates_prevent_self_lockout_and_last_admin_removal():
	client, engine = admin_core_client()
	try:
		headers = auth_headers("admin@example.com", "admin")
		self_update = client.patch(
			"/api/v1/admin/users/1",
			headers=headers,
			json={"is_active": False},
		)
		assert self_update.status_code == 409

		last_admin = client.patch(
			"/api/v1/admin/users/1",
			headers=headers,
			json={"role": "recruiter"},
		)
		assert last_admin.status_code == 409

		promote_response = client.patch(
			"/api/v1/admin/users/2",
			headers=headers,
			json={"role": "recruiter"},
		)
		assert promote_response.status_code == 200
		assert promote_response.json()["role"] == "recruiter"

		student_update = client.patch(
			"/api/v1/admin/users/2",
			headers=headers,
			json={"is_active": False},
		)
		assert student_update.status_code == 200
		assert student_update.json()["is_active"] is False

		invalid_role = client.patch(
			"/api/v1/admin/users/2",
			headers=headers,
			json={"role": "faculty"},
		)
		assert invalid_role.status_code == 422
	finally:
		client.close()
		engine.dispose()


def test_admin_can_change_another_admin_when_an_active_admin_remains():
	client, engine = admin_core_client()
	try:
		with Session(engine) as session:
			session.add(User(
				email="second-admin@example.com",
				hashed_password="another-secret",
				role="admin",
				is_active=True,
			))
			session.commit()

		response = client.patch(
			"/api/v1/admin/users/1",
			headers=auth_headers("second-admin@example.com", "admin"),
			json={"role": "recruiter"},
		)
		assert response.status_code == 200
		assert response.json()["role"] == "recruiter"
	finally:
		client.close()
		engine.dispose()


def test_admin_student_directory_returns_minimum_directory_fields():
	client, engine = admin_core_client()
	try:
		response = client.get(
			"/api/v1/admin/students",
			params={"search": "BPUT-001", "branch": "CSE", "onboarding_complete": "true"},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		student = response.json()[0]
		assert student["university_roll_number"] == "BPUT-001"
		assert student["cgpa"] == 8.2
		assert student["college_id_verified"] is True
		assert "resume_url" not in student
		assert "leadership_notes" not in student
	finally:
		client.close()
		engine.dispose()


def test_admin_recruiter_directory_uses_real_company_and_posting_data():
	client, engine = admin_core_client()
	try:
		response = client.get(
			"/api/v1/admin/recruiters",
			params={"search": "Example Systems"},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		assert response.json() == [{
			"id": 3,
			"email": "recruiter@example.com",
			"is_active": True,
			"company_name": "Example Systems",
			"description": "Software services",
			"website": "https://example.com",
			"location": "Bhubaneswar",
			"industry": "Software",
			"job_posting_count": 1,
		}]
	finally:
		client.close()
		engine.dispose()


def test_admin_recruiter_directory_marks_unassociated_posting_count_unavailable():
	client, engine = admin_core_client()
	try:
		with Session(engine) as session:
			session.add(User(
				email="unlinked-recruiter@example.com",
				hashed_password="recruiter-secret",
				role="recruiter",
				is_active=True,
			))
			session.commit()

		response = client.get(
			"/api/v1/admin/recruiters",
			params={"search": "unlinked-recruiter"},
			headers=auth_headers("admin@example.com", "admin"),
		)
		assert response.status_code == 200
		assert response.json()[0]["job_posting_count"] is None
	finally:
		client.close()
		engine.dispose()
