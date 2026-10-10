import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.recruiter_profile import router as recruiter_profile_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import User


@pytest.fixture
def recruiter_profile_client():
	engine = create_engine(
		"sqlite://",
		connect_args={"check_same_thread": False},
		poolclass=StaticPool,
	)
	Base.metadata.create_all(engine)
	with Session(engine) as session:
		session.add_all(
			[
				User(
					email="recruiter@example.com",
					hashed_password="not-a-real-password-hash",
					role="recruiter",
					is_active=True,
				),
				User(
					email="other-recruiter@example.com",
					hashed_password="not-a-real-password-hash",
					role="recruiter",
					is_active=True,
				),
				User(
					email="student@example.com",
					hashed_password="not-a-real-password-hash",
					role="student",
					is_active=True,
				),
			]
		)
		session.commit()

	def override_get_db():
		with Session(engine) as session:
			yield session

	app = FastAPI()
	app.include_router(recruiter_profile_router, prefix="/api/v1")
	app.dependency_overrides[get_db] = override_get_db
	with TestClient(app) as client:
		yield client
	engine.dispose()


def _headers(email: str, role: str = "recruiter") -> dict[str, str]:
	token = create_access_token(email=email, role=role)
	return {"Authorization": f"Bearer {token}"}


def test_profile_requires_an_authenticated_recruiter(
	recruiter_profile_client: TestClient,
) -> None:
	assert recruiter_profile_client.get("/api/v1/recruiter-profile").status_code == 401
	student_response = recruiter_profile_client.get(
		"/api/v1/recruiter-profile",
		headers=_headers("student@example.com", "student"),
	)
	assert student_response.status_code == 403


def test_profile_updates_are_private_to_the_authenticated_user(
	recruiter_profile_client: TestClient,
) -> None:
	client = recruiter_profile_client
	first_headers = _headers("recruiter@example.com")
	second_headers = _headers("other-recruiter@example.com")

	initial = client.get("/api/v1/recruiter-profile", headers=first_headers)
	assert initial.status_code == 200
	assert initial.json()["account"] == {
		"email": "recruiter@example.com",
		"role": "recruiter",
		"is_active": True,
	}
	assert initial.json()["company_name"] is None

	saved = client.put(
		"/api/v1/recruiter-profile",
		headers=first_headers,
		json={
			"company_name": "Example Systems",
			"description": "A software company.",
			"website": "https://example.com",
			"logo_url": "https://example.com/logo.png",
			"location": "Bhubaneswar, India",
			"industry": "Software",
			"contact_name": "Recruiter",
			"contact_email": "talent@example.com",
			"contact_phone": "+1 555 0100",
		},
	)
	assert saved.status_code == 200
	assert saved.json()["company_name"] == "Example Systems"
	assert saved.json()["website"] == "https://example.com/"

	other_profile = client.get("/api/v1/recruiter-profile", headers=second_headers)
	assert other_profile.status_code == 200
	assert other_profile.json()["company_name"] is None
	assert other_profile.json()["account"]["email"] == "other-recruiter@example.com"


def test_profile_rejects_invalid_website_and_contact_email(
	recruiter_profile_client: TestClient,
) -> None:
	response = recruiter_profile_client.put(
		"/api/v1/recruiter-profile",
		headers=_headers("recruiter@example.com"),
		json={"website": "not-a-url", "contact_email": "invalid"},
	)
	assert response.status_code == 422
