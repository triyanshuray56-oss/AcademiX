import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from unittest.mock import AsyncMock, patch

from backend.app.api.v1.notices import router as student_notices_router
from backend.app.api.v1.recruiter_notices import router as recruiter_notices_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import User


@pytest.fixture
def recruiter_notices_client():
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
				User(
					email="admin@example.com",
					hashed_password="not-a-real-password-hash",
					role="admin",
					is_active=True,
				),
			]
		)
		session.commit()

	def override_get_db():
		with Session(engine) as session:
			yield session

	app = FastAPI()
	app.include_router(recruiter_notices_router, prefix="/api/v1")
	app.include_router(student_notices_router, prefix="/api/v1")
	app.dependency_overrides[get_db] = override_get_db
	with TestClient(app) as client:
		yield client
	engine.dispose()


def _headers(email: str, role: str = "recruiter") -> dict[str, str]:
	token = create_access_token(email=email, role=role)
	return {"Authorization": f"Bearer {token}"}


def test_recruiter_can_publish_and_list_own_notice(
	recruiter_notices_client: TestClient,
) -> None:
	client = recruiter_notices_client
	response = client.post(
		"/api/v1/recruiter-notices",
		headers=_headers("recruiter@example.com"),
		json={
			"title": "Graduate hiring update",
			"message": "Applications are open for the graduate role.",
			"category": "Recruitment drive",
			"priority": "High",
		},
	)

	assert response.status_code == 201
	created = response.json()
	assert created["audience"] == "All Students"
	assert created["category"] == "Recruitment drive"
	assert created["is_published"] is True
	assert created["priority"] == "High"

	listed = client.get(
		"/api/v1/recruiter-notices",
		headers=_headers("recruiter@example.com"),
	)
	assert listed.status_code == 200
	assert [notice["id"] for notice in listed.json()] == [created["id"]]

	other_recruiter_list = client.get(
		"/api/v1/recruiter-notices",
		headers=_headers("other-recruiter@example.com"),
	)
	assert other_recruiter_list.status_code == 200
	assert other_recruiter_list.json() == []


@pytest.mark.parametrize(
	("email", "role", "expected_status"),
	[
		("student@example.com", "student", 403),
		("admin@example.com", "admin", 403),
	],
)
def test_notice_management_requires_recruiter_role(
	recruiter_notices_client: TestClient,
	email: str,
	role: str,
	expected_status: int,
) -> None:
	client = recruiter_notices_client
	headers = _headers(email, role)

	assert client.get("/api/v1/recruiter-notices", headers=headers).status_code == expected_status
	assert client.post(
		"/api/v1/recruiter-notices",
		headers=headers,
		json={"title": "Hiring update", "message": "Applications are open."},
	).status_code == expected_status


def test_notice_management_requires_authentication(
	recruiter_notices_client: TestClient,
) -> None:
	assert recruiter_notices_client.get("/api/v1/recruiter-notices").status_code == 401
	assert recruiter_notices_client.post(
		"/api/v1/recruiter-notices",
		json={"title": "Hiring update", "message": "Applications are open."},
	).status_code == 401


def test_published_recruiter_notice_appears_in_existing_student_feed(
	recruiter_notices_client: TestClient,
) -> None:
	client = recruiter_notices_client
	created = client.post(
		"/api/v1/recruiter-notices",
		headers=_headers("recruiter@example.com"),
		json={"title": "Hiring update", "message": "Applications are open."},
	)
	assert created.status_code == 201

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
		student_feed = client.get("/api/v1/notices/announcements")

	assert student_feed.status_code == 200
	assert any(
		item["title"] == "Hiring update"
		and item["category"] == "General"
		for item in student_feed.json()
	)
