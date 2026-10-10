import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import gettempdir

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import backend.app.database as database_module
import backend.app.main as main_module
from backend.app.database import Base
from backend.app.main import app
from backend.app.core.security import (
	JWT_ALGORITHM,
	JWT_SECRET_KEY,
	get_password_hash,
	hash_reset_token,
	require_roles,
	verify_password,
)
from backend.app.models import MatchRecord, RecruiterJD, User


@pytest.fixture(scope="session")
def test_engine():
	test_db_path = Path(gettempdir()) / f"campuslink_api_tests_{uuid.uuid4().hex}.db"
	engine = create_engine(
		f"sqlite:///{test_db_path.as_posix()}",
		connect_args={"check_same_thread": False},
	)
	session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
	original_engine = database_module.engine
	original_session_local = database_module.SessionLocal
	original_main_session_local = main_module.SessionLocal
	database_module.engine = engine
	database_module.SessionLocal = session_factory
	main_module.SessionLocal = session_factory
	try:
		yield engine
	finally:
		engine.dispose()
		database_module.engine = original_engine
		database_module.SessionLocal = original_session_local
		main_module.SessionLocal = original_main_session_local
		test_db_path.unlink(missing_ok=True)


@pytest.fixture
def client(test_engine):
	Base.metadata.drop_all(bind=test_engine)
	with TestClient(app) as test_client:
		yield test_client


def test_root_health_check(client: TestClient) -> None:
	response = client.get("/")
	assert response.status_code == 200
	assert response.json() == {"status": "ok"}


def test_student_crud_recalculates_readiness_and_validates_payloads(
	client: TestClient,
) -> None:
	invalid = client.post(
		"/api/students",
		json={
			"name": "Invalid Candidate",
			"email": "invalid@example.edu",
			"branch": "CSE",
			"cgpa": 11,
		},
	)
	assert invalid.status_code == 422

	payload = {
		"name": "Test Candidate",
		"email": "test.candidate@example.edu",
		"branch": "CSE",
		"cgpa": 8.5,
		"skills": "Python, React, SQL",
		"mock_interview_score": 80,
	}
	created = client.post("/api/students", json=payload)
	assert created.status_code == 201
	student = created.json()
	assert student["readiness_score"] == 75.5
	assert student["readiness_status"] == "Ready"
	student_id = student["id"]

	student_list = client.get("/api/students")
	assert student_list.status_code == 200
	assert any(item["id"] == student_id for item in student_list.json())
	assert client.get(f"/api/students/{student_id}").json()["email"] == payload["email"]

	updated = client.put(
		f"/api/students/{student_id}",
		json={
			"cgpa": 9.0,
			"skills": "Python, Java, React, AWS, SQL",
			"mock_interview_score": 100,
		},
	)
	assert updated.status_code == 200
	assert updated.json()["readiness_score"] == 97.0
	assert updated.json()["readiness_status"] == "Highly Employable"
	assert client.put(f"/api/students/{student_id}", json={"cgpa": 11}).status_code == 422

	assert client.delete(f"/api/students/{student_id}").status_code == 200
	assert client.get(f"/api/students/{student_id}").status_code == 404
	assert client.delete(f"/api/students/{student_id}").status_code == 404


def test_recruiter_jd_and_drive_crud(client: TestClient) -> None:
	jd_payload = {
		"company_name": "Test Corp",
		"role_title": "Backend Engineer",
		"min_cgpa": 7.0,
		"required_skills": "Python, SQL",
		"package_lpa": 10.0,
	}
	created_jd = client.post("/api/recruiters", json=jd_payload)
	assert created_jd.status_code == 201
	jd_id = created_jd.json()["id"]
	assert any(jd["id"] == jd_id for jd in client.get("/api/recruiters").json())
	assert client.get(f"/api/recruiters/{jd_id}").status_code == 200
	assert client.put(f"/api/recruiters/{jd_id}", json={"package_lpa": 12}).json()["package_lpa"] == 12
	assert client.delete(f"/api/recruiters/{jd_id}").status_code == 200
	assert client.get(f"/api/recruiters/{jd_id}").status_code == 404

	drive_payload = {
		"company_name": "Test Corp",
		"drive_date": "2026-11-01T10:00:00",
		"venue": "Engineering Block",
	}
	created_drive = client.post("/api/drives", json=drive_payload)
	assert created_drive.status_code == 201
	drive_id = created_drive.json()["id"]
	assert client.get(f"/api/drives/{drive_id}").status_code == 200
	assert client.put(
		f"/api/drives/{drive_id}", json={"status": "Completed"}
	).json()["status"] == "Completed"
	assert all(drive["id"] != drive_id for drive in client.get("/api/drives").json()["drives"])
	assert client.delete(f"/api/drives/{drive_id}").status_code == 200
	assert client.get(f"/api/drives/{drive_id}").status_code == 404


def test_matching_run_stores_explainable_records_idempotently(
	client: TestClient,
	test_engine,
) -> None:
	drives = client.get("/api/drives").json()["drives"]
	tcs_drive = next(drive for drive in drives if drive["company_name"] == "TCS")

	first_run = client.post(f"/api/matching/run-drive/{tcs_drive['id']}")
	assert first_run.status_code == 200
	assert first_run.json()["created_records"] > 0
	assert first_run.json()["matches"][0]["explanation"]
	with sessionmaker(bind=test_engine)() as session:
		stored_records = list(
			session.scalars(
				select(MatchRecord).where(
					MatchRecord.jd_id.in_(
						select(RecruiterJD.id).where(RecruiterJD.company_name == "TCS")
					)
				)
			)
		)
	assert len(stored_records) == first_run.json()["created_records"]
	assert all(record.fit_score >= 0 and record.explanation for record in stored_records)

	second_run = client.post(f"/api/matching/run-drive/{tcs_drive['id']}")
	assert second_run.status_code == 200
	assert second_run.json()["created_records"] == 0


def test_analytics_has_dashboard_metrics_and_package_trends(client: TestClient) -> None:
	response = client.get("/api/dashboard/analytics")
	assert response.status_code == 200
	data = response.json()
	assert {
		"total_students",
		"placement_ready_count",
		"active_drives_count",
		"offers_accepted",
		"branch_conversion_percentages",
		"package_trends",
		"at_risk_unplaced_count",
	} <= data.keys()
	assert data["total_students"] == 10
	assert data["placement_ready_count"] == 6
	assert data["active_drives_count"] == 3
	assert data["offers_accepted"] == 0
	assert set(data["branch_conversion_percentages"]) == {"CSE", "ETC"}
	assert data["package_trends"]["TCS"] == 7.0
	assert data["at_risk_unplaced_count"] == 1


def test_conflict_endpoint_returns_suggestions(client: TestClient) -> None:
	response = client.get("/api/drives/conflicts")
	assert response.status_code == 200
	conflicts = response.json()
	tcs_drive = next(
		drive
		for drive in client.get("/api/drives").json()["drives"]
		if drive["company_name"] == "TCS"
	)
	infosys_drive = next(
		drive
		for drive in client.get("/api/drives").json()["drives"]
		if drive["company_name"] == "Infosys"
	)
	conflict = next(
		item
		for item in conflicts
		if set(item["drive_ids"]) == {tcs_drive["id"], infosys_drive["id"]}
	)
	assert {"same_date", "same_datetime", "same_venue"} <= set(conflict["conflict_types"])
	assert conflict["suggestions"]
	assert "2026-10-17T10:00" in conflict["suggestions"][0]
	assert "different venue" in conflict["suggestions"][0]


@pytest.mark.parametrize("role", ["student", "recruiter", "admin"])
def test_auth_signup_login_and_role_claims(
	client: TestClient,
	test_engine,
	monkeypatch: pytest.MonkeyPatch,
	role: str,
) -> None:
	email = f"{role}.auth@example.edu"
	password = "secure-test-password-42"
	headers = None
	if role != "student":
		registration_key = f"{role}-signup-test-key"
		monkeypatch.setenv(f"CAMPUSLINK_{role.upper()}_SIGNUP_KEY", registration_key)
		denied_signup = client.post(
			"/api/auth/signup",
			json={"email": email, "password": password, "role": role},
			headers={"X-Role-Registration-Key": "invalid-demo-key"},
		)
		assert denied_signup.status_code == 403
		headers = {"X-Role-Registration-Key": registration_key}
	signup = client.post(
		"/api/auth/signup",
		json={"email": email, "password": password, "role": role},
		headers=headers,
	)
	assert signup.status_code == 201
	assert signup.json()["role"] == role

	with sessionmaker(bind=test_engine)() as session:
		user = session.scalar(select(User).where(User.email == email))
		assert user is not None
		assert user.hashed_password != password
		assert verify_password(password, user.hashed_password)
		assert user.is_active

	duplicate = client.post(
		"/api/auth/signup",
		json={"email": email.upper(), "password": password, "role": role},
		headers=headers,
	)
	assert duplicate.status_code == 400

	login = client.post(
		"/api/auth/login",
		json={"email": email, "password": password, "expected_role": role},
	)
	assert login.status_code == 200
	token_data = login.json()
	assert token_data["token_type"] == "bearer"
	claims = jwt.decode(
		token_data["access_token"],
		JWT_SECRET_KEY,
		algorithms=[JWT_ALGORITHM],
	)
	assert claims["sub"] == email
	assert claims["role"] == role
	assert claims["exp"] > datetime.now(UTC).timestamp()

	wrong_portal = client.post(
		"/api/auth/login",
		json={
			"email": email,
			"password": password,
			"expected_role": "admin" if role != "admin" else "student",
		},
	)
	assert wrong_portal.status_code == 403
	assert "Please use the" in wrong_portal.json()["detail"]

	profile = client.get(
		"/api/auth/me",
		headers={"Authorization": f"Bearer {token_data['access_token']}"},
	)
	assert profile.status_code == 200
	assert profile.json()["role"] == role

	bad_login = client.post(
		"/api/auth/login",
		json={"email": email, "password": "incorrect-password", "expected_role": role},
	)
	assert bad_login.status_code == 401
	form_login = client.post(
		"/api/auth/login",
		data={"username": email, "password": password, "expected_role": role},
	)
	assert form_login.status_code == 200

	with sessionmaker(bind=test_engine)() as session:
		user = session.scalar(select(User).where(User.email == email))
		assert user is not None
		user.role = "student" if role != "student" else "admin"
		session.commit()
	assert client.get(
		"/api/auth/me",
		headers={"Authorization": f"Bearer {token_data['access_token']}"},
	).status_code == 401

	with sessionmaker(bind=test_engine)() as session:
		user = session.scalar(select(User).where(User.email == email))
		assert user is not None
		user.is_active = False
		session.commit()
	assert client.post(
		"/api/auth/login",
		json={"email": email, "password": password, "expected_role": role},
	).status_code == 401


@pytest.mark.parametrize(
	("role", "registration_key"),
	[("recruiter", "recruiter123"), ("admin", "admin123")],
)
def test_role_signup_uses_local_demo_fallback_when_key_is_unset(
	client: TestClient,
	monkeypatch: pytest.MonkeyPatch,
	role: str,
	registration_key: str,
) -> None:
	monkeypatch.delenv(f"CAMPUSLINK_{role.upper()}_SIGNUP_KEY", raising=False)
	response = client.post(
		"/api/auth/signup",
		json={
			"email": f"{role}.demo.{uuid.uuid4().hex}@example.edu",
			"password": "secure-demo-password",
			"role": role,
		},
		headers={"X-Role-Registration-Key": registration_key},
	)
	assert response.status_code == 201
	assert response.json()["role"] == role


def test_auth_rejects_invalid_roles_payloads_and_unauthenticated_profiles(
	client: TestClient,
) -> None:
	invalid_role = client.post(
		"/api/auth/signup",
		json={
			"email": "invalid.role@example.edu",
			"password": "secure-test-password-42",
			"role": "superuser",
		},
	)
	assert invalid_role.status_code == 422
	assert client.post(
		"/api/auth/signup",
		json={
			"email": "weak.password@example.edu",
			"password": "short",
			"role": "student",
		},
	).status_code == 422
	assert client.get("/api/auth/me").status_code == 401

	user = User(
		email="student.role@example.edu",
		hashed_password=get_password_hash("secure-test-password-42"),
		role="student",
	)
	assert require_roles("student")(user) is user
	with pytest.raises(HTTPException) as error:
		require_roles("admin")(user)
	assert error.value.status_code == 403


def test_forgot_and_reset_password_is_single_use_and_expires(
	client: TestClient,
	test_engine,
) -> None:
	email = "reset.user@example.edu"
	old_password = "old-secure-password-42"
	new_password = "new-secure-password-43"
	assert client.post(
		"/api/auth/signup",
		json={"email": email, "password": old_password, "role": "student"},
	).status_code == 201

	missing_user = client.post(
		"/api/auth/forgot-password", json={"email": "missing@example.edu"}
	)
	assert missing_user.status_code == 200
	assert missing_user.json()["reset_token"] is None

	forgot = client.post("/api/auth/forgot-password", json={"email": email})
	assert forgot.status_code == 200
	reset_token = forgot.json()["reset_token"]
	assert reset_token
	with sessionmaker(bind=test_engine)() as session:
		user = session.scalar(select(User).where(User.email == email))
		assert user is not None
		assert user.reset_token == hash_reset_token(reset_token)
		assert user.reset_token_expires is not None

	invalid_reset = client.post(
		"/api/auth/reset-password",
		json={"email": email, "reset_token": "wrong-reset-token-123456", "new_password": new_password},
	)
	assert invalid_reset.status_code == 400

	reset = client.post(
		"/api/auth/reset-password",
		json={"email": email, "reset_token": reset_token, "new_password": new_password},
	)
	assert reset.status_code == 200
	assert client.post(
		"/api/auth/reset-password",
		json={"email": email, "reset_token": reset_token, "new_password": old_password},
	).status_code == 400
	assert client.post(
		"/api/auth/login",
		json={"email": email, "password": old_password, "expected_role": "student"},
	).status_code == 401
	assert client.post(
		"/api/auth/login",
		json={"email": email, "password": new_password, "expected_role": "student"},
	).status_code == 200
	with sessionmaker(bind=test_engine)() as session:
		user = session.scalar(select(User).where(User.email == email))
		assert user is not None
		assert user.reset_token is None
		assert user.reset_token_expires is None
		assert verify_password(new_password, user.hashed_password)

	expiring_email = "expired.reset@example.edu"
	assert client.post(
		"/api/auth/signup",
		json={
			"email": expiring_email,
			"password": old_password,
			"role": "student",
		},
	).status_code == 201
	expiring_token = client.post(
		"/api/auth/forgot-password", json={"email": expiring_email}
	).json()["reset_token"]
	with sessionmaker(bind=test_engine)() as session:
		expiring_user = session.scalar(select(User).where(User.email == expiring_email))
		assert expiring_user is not None
		expiring_user.reset_token_expires = datetime.now(UTC) - timedelta(minutes=1)
		session.commit()
	expired_reset = client.post(
		"/api/auth/reset-password",
		json={
			"email": expiring_email,
			"reset_token": expiring_token,
			"new_password": new_password,
		},
	)
	assert expired_reset.status_code == 400
	with sessionmaker(bind=test_engine)() as session:
		expiring_user = session.scalar(select(User).where(User.email == expiring_email))
		assert expiring_user is not None
		assert expiring_user.reset_token is None
		assert expiring_user.reset_token_expires is None


def test_recruiter_deep_profile_returns_xai_factors_and_persists_actions(
	client: TestClient,
	monkeypatch: pytest.MonkeyPatch,
) -> None:
	students = client.get("/api/students").json()
	student = next(item for item in students if item["email"] == "ananya.mohanty@bput.ac.in")
	assert client.get(f"/api/students/{student['id']}/deep-profile").status_code == 401
	deep_fields = {
		"semester_cgpas": [8.6, 8.8, 9.0],
		"active_backlogs": 0,
		"cleared_backlogs": 1,
		"tenth_percentage": 92,
		"twelfth_percentage": 89,
		"university_roll_number": "BPUT-21-CSE-001",
		"branch_rank": 3,
		"branch_percentile": 98.4,
		"leetcode_rating": 1540,
		"hackerrank_rating": 4.5,
		"coding_score": 91,
		"github_url": "https://github.com/ananya",
		"portfolio_url": "https://ananya.example.edu",
		"system_design_score": 78,
		"verified_tech_stack": ["Python", "React", "Python"],
		"ai_speech_score": 84,
		"aptitude_score": 88,
		"leadership_notes": "Coding club lead",
		"internship_experiences": [
			{
				"company": "BPUT Labs",
				"role": "Software Intern",
				"duration_months": 3,
				"mentor_rating": 91,
				"description": "Built placement tools.",
			}
		],
		"mentor_rating": 91,
		"project_showcase": [
			{
				"title": "Placement tracker",
				"description": "A placement status dashboard.",
				"preview_url": "https://demo.example.edu",
				"repository_url": "https://github.com/ananya/tracker",
				"tech_stack": ["React", "FastAPI"],
			}
		],
	}
	assert client.put(f"/api/students/{student['id']}", json=deep_fields).status_code == 200

	student_signup = client.post(
		"/api/auth/signup",
		json={
			"email": "deep.profile.student@example.edu",
			"password": "deep-profile-test-password",
			"role": "student",
		},
	)
	assert student_signup.status_code == 201
	student_login = client.post(
		"/api/auth/login",
		json={
			"email": "deep.profile.student@example.edu",
			"password": "deep-profile-test-password",
			"expected_role": "student",
		},
	)
	student_token = student_login.json()["access_token"]
	assert client.get(
		f"/api/students/{student['id']}/deep-profile",
		headers={"Authorization": f"Bearer {student_token}"},
	).status_code == 403

	monkeypatch.setenv("CAMPUSLINK_RECRUITER_SIGNUP_KEY", "recruiter-deep-profile-key")
	recruiter_signup = client.post(
		"/api/auth/signup",
		json={
			"email": "deep.profile.recruiter@example.edu",
			"password": "deep-profile-test-password",
			"role": "recruiter",
		},
		headers={"X-Role-Registration-Key": "recruiter-deep-profile-key"},
	)
	assert recruiter_signup.status_code == 201
	recruiter_login = client.post(
		"/api/auth/login",
		json={
			"email": "deep.profile.recruiter@example.edu",
			"password": "deep-profile-test-password",
			"expected_role": "recruiter",
		},
	)
	recruiter_headers = {
		"Authorization": f"Bearer {recruiter_login.json()['access_token']}"
	}

	drives = client.get("/api/drives").json()["drives"]
	tcs_drive = next(drive for drive in drives if drive["company_name"] == "TCS")
	matching_run = client.post(f"/api/matching/run-drive/{tcs_drive['id']}")
	assert matching_run.status_code == 200
	match_record = matching_run.json()["matches"][0]

	profile_response = client.get(
		f"/api/students/{student['id']}/deep-profile",
		headers=recruiter_headers,
	)
	assert profile_response.status_code == 200
	profile = profile_response.json()
	assert profile["student"]["semester_cgpas"] == [8.6, 8.8, 9.0]
	assert profile["student"]["leetcode_rating"] == 1540
	assert profile["student"]["verified_tech_stack"] == ["Python", "React"]
	assert profile["student"]["internship_experiences"][0]["company"] == "BPUT Labs"
	assert profile["student"]["project_showcase"][0]["preview_url"] == "https://demo.example.edu"
	assert profile["active_drive_match_factors"]
	tcs_factor = next(
		factor
		for factor in profile["active_drive_match_factors"]
		if factor["drive_id"] == tcs_drive["id"]
	)
	assert tcs_factor["fit_score"] >= 0
	assert tcs_factor["reason"]
	assert isinstance(tcs_factor["matched_skills"], list)
	assert isinstance(tcs_factor["missing_skills"], list)

	updated_action = client.patch(
		f"/api/matching/{match_record['id']}/recruiter-action",
		json={"status": "Interview Scheduled"},
		headers=recruiter_headers,
	)
	assert updated_action.status_code == 200
	assert updated_action.json()["recruiter_action_status"] == "Interview Scheduled"
	assert client.patch(
		f"/api/matching/{match_record['id']}/recruiter-action",
		json={"status": "Offer Extended"},
		headers={"Authorization": f"Bearer {student_token}"},
	).status_code == 403

	refreshed_profile = client.get(
		f"/api/students/{student['id']}/deep-profile",
		headers=recruiter_headers,
	).json()
	refreshed_tcs_factor = next(
		factor
		for factor in refreshed_profile["active_drive_match_factors"]
		if factor["drive_id"] == tcs_drive["id"]
	)
	assert refreshed_tcs_factor["recruiter_action_status"] == "Interview Scheduled"


def test_student_onboarding_upserts_profile_for_authenticated_email(
	client: TestClient,
	monkeypatch: pytest.MonkeyPatch,
) -> None:
	email = "new.student@example.edu"
	password = "onboarding-secure-password"
	assert client.post(
		"/api/auth/signup",
		json={"email": email, "password": password, "role": "student"},
	).status_code == 201
	login = client.post(
		"/api/auth/login",
		json={"email": email, "password": password, "expected_role": "student"},
	)
	headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
	assert client.get("/api/students/me", headers=headers).status_code == 404

	payload = {
		"name": "New Student",
		"branch": "CSE",
		"cgpa": 8.2,
		"semester_cgpas": [7.8, 8.1, 8.4],
		"active_backlogs": 0,
		"cleared_backlogs": 1,
		"tenth_percentage": 91,
		"twelfth_percentage": 88,
		"university_roll_number": "BPUT-25-CSE-009",
		"verified_tech_stack": ["Python", "React"],
		"leetcode_rating": 1200,
		"github_url": "https://github.com/newstudent",
		"portfolio_url": "https://newstudent.example.edu",
		"resume_url": "https://files.example.edu/resume.pdf",
		"resume_filename": "resume.pdf",
		"documents_confirmed": True,
		"profile_picture_url": "data:image/png;base64,aGVsbG8=",
		"college_id_card_url": "data:application/pdf;base64,JVBERi0xLjQ=",
	}
	created = client.post("/api/students/profile", json=payload, headers=headers)
	assert created.status_code == 200
	profile = created.json()
	assert profile["email"] == email
	assert profile["onboarding_complete"] is True
	assert profile["profile_picture_url"] == payload["profile_picture_url"]
	assert profile["college_id_card_url"] == payload["college_id_card_url"]
	assert profile["college_id_verified"] is False
	assert profile["college_id_card_url"] == payload["college_id_card_url"]
	assert profile["college_id_verified"] is False
	assert profile["readiness_score"] == 36.6
	assert profile["readiness_status"] == "Not Ready"
	student_id = profile["id"]

	updated = client.post(
		"/api/students/profile",
		json={**payload, "cgpa": 9.0, "verified_tech_stack": ["Python", "React", "SQL", "Java"]},
		headers=headers,
	)
	assert updated.status_code == 200
	assert updated.json()["id"] == student_id
	assert updated.json()["readiness_score"] == 51.0
	assert updated.json()["profile_picture_url"] == payload["profile_picture_url"]
	assert updated.json()["college_id_card_url"] == payload["college_id_card_url"]
	assert updated.json()["college_id_verified"] is False
	assert updated.json()["college_id_verified"] is False
	assert client.get("/api/students/me", headers=headers).json()["id"] == student_id
	assert client.get("/api/students/me").status_code == 401
	assert client.patch(
		f"/api/students/{student_id}/college-id-verification",
		json={"college_id_verified": True},
		headers=headers,
	).status_code == 403
	assert client.put(
		f"/api/students/{student_id}",
		json={"profile_picture_url": "data:image/png;base64,not-valid!"},
	).status_code == 422
	assert client.put(
		f"/api/students/{student_id}",
		json={"college_id_card_url": "data:image/gif;base64,R0lGODlh"},
	).status_code == 422
	assert client.patch(
		f"/api/students/{student_id}/college-id-verification",
		json={"college_id_verified": True},
		headers=headers,
	).status_code == 403

	monkeypatch.setenv("CAMPUSLINK_ADMIN_SIGNUP_KEY", "college-id-admin-key")
	admin_signup = client.post(
		"/api/auth/signup",
		json={
			"email": "college.id.admin@example.edu",
			"password": "college-id-admin-password",
			"role": "admin",
		},
		headers={"X-Role-Registration-Key": "college-id-admin-key"},
	)
	assert admin_signup.status_code == 201
	admin_login = client.post(
		"/api/auth/login",
		json={
			"email": "college.id.admin@example.edu",
			"password": "college-id-admin-password",
			"expected_role": "admin",
		},
	)
	admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
	verified = client.patch(
		f"/api/students/{student_id}/college-id-verification",
		json={"college_id_verified": True},
		headers=admin_headers,
	)
	assert verified.status_code == 200
	assert verified.json()["college_id_verified"] is True
	assert client.get("/api/students/me", headers=headers).json()["college_id_verified"] is True
	assert client.put(
		f"/api/students/{student_id}",
		json={"college_id_card_url": "data:image/gif;base64,R0lGODlh"},
	).status_code == 422
	replaced = client.put(
		f"/api/students/{student_id}",
		json={"college_id_card_url": "data:image/png;base64,aGVsbG8="},
	)
	assert replaced.status_code == 200
	assert replaced.json()["college_id_verified"] is False
