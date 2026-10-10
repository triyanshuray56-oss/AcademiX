from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.recruiter_offers import router as recruiter_offers_router
from backend.app.core.security import create_access_token
from backend.app.database import Base, get_db
from backend.app.models import RecruiterJD, RecruiterOffer, Student, StudentApplication, User


@pytest.fixture
def recruiter_offers_client():
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
		target_job = RecruiterJD(
			company_name="Example Co",
			role_title="Graduate Engineer",
			min_cgpa=6.0,
			required_skills="Python",
			package_lpa=7.5,
		)
		legacy_job = RecruiterJD(
			company_name="Example Org",
			role_title="Data Analyst",
			min_cgpa=6.0,
			required_skills="SQL",
			package_lpa=8.0,
		)
		ambiguous_job_one = RecruiterJD(
			company_name="Duplicate Co",
			role_title="Same Role",
			min_cgpa=6.0,
			required_skills="Python",
			package_lpa=7.0,
		)
		ambiguous_job_two = RecruiterJD(
			company_name=" duplicate co ",
			role_title=" SAME ROLE ",
			min_cgpa=6.0,
			required_skills="Python",
			package_lpa=7.0,
		)
		session.add_all(
			[
				target_job,
				legacy_job,
				ambiguous_job_one,
				ambiguous_job_two,
			]
		)
		session.flush()

		student_data = [
			("Direct Candidate", "direct@example.com", "CSE", 8.0, "Python"),
			("Legacy Candidate", "legacy@example.com", "ECE", 7.8, "SQL"),
			("Legacy Offered", "offered@example.com", "IT", 7.5, "SQL"),
			("Wrong Company", "company@example.com", "CSE", 7.0, "Python"),
			("Wrong Role", "role@example.com", "CSE", 7.0, "Python"),
			("Ambiguous Candidate", "ambiguous@example.com", "ECE", 8.0, "Python"),
		]
		students = [
			Student(name=name, email=email, branch=branch, cgpa=cgpa, skills=skills)
			for name, email, branch, cgpa, skills in student_data
		]
		session.add_all(students)
		session.flush()
		application_specs = [
			(students[0], f"recruiter-jd-{target_job.id}", target_job.company_name, target_job.role_title),
			(students[1], "external-feed-legacy-1", "  EXAMPLE ORG ", " data analyst "),
			(students[2], "external-feed-legacy-2", "Example Org", "Data Analyst"),
			(students[3], "external-feed-company", "Different Company", "Data Analyst"),
			(students[4], "external-feed-role", "Example Org", "Different Role"),
			(students[5], "external-feed-ambiguous", "DUPLICATE CO", "same role"),
		]
		applications = [
			StudentApplication(
				student_id=student.id,
				external_job_id=external_job_id,
				job_title=job_title,
				company_name=company_name,
				job_url="https://jobs.example/apply",
				status="Applied",
			)
			for student, external_job_id, company_name, job_title in application_specs
		]
		session.add_all(applications)
		session.flush()
		session.add(
			RecruiterOffer(
				application_id=applications[2].id,
				package_lpa=8.0,
				offer_date=datetime.now(timezone.utc),
				employment_type="job",
				notes="Existing offer",
			)
		)
		session.commit()
		job_ids = {
			"direct": target_job.id,
			"legacy": legacy_job.id,
			"ambiguous": ambiguous_job_one.id,
		}
		application_ids = {
			"direct": applications[0].id,
			"legacy": applications[1].id,
			"offered": applications[2].id,
			"ambiguous": applications[5].id,
		}

	def override_get_db():
		with Session(engine) as session:
			yield session

	app = FastAPI()
	app.include_router(recruiter_offers_router, prefix="/api/v1")
	app.dependency_overrides[get_db] = override_get_db
	with TestClient(app) as client:
		yield client, job_ids, application_ids
	engine.dispose()


def _headers(
	email: str = "recruiter@example.com",
	role: str = "recruiter",
) -> dict[str, str]:
	token = create_access_token(email=email, role=role)
	return {"Authorization": f"Bearer {token}"}


def _applicants(client: TestClient, job_id: int, headers=None) -> dict:
	response = client.get(
		"/api/v1/recruiter-portal/offers/applicants",
		params={"recruiter_jd_id": job_id},
		headers=headers or _headers(),
	)
	assert response.status_code == 200
	return response.json()


def test_direct_recruiter_linked_application_is_returned(recruiter_offers_client) -> None:
	client, jobs, applications = recruiter_offers_client

	result = _applicants(client, jobs["direct"])

	assert [applicant["application_id"] for applicant in result["applicants"]] == [
		applications["direct"]
	]
	assert result["applicants"][0]["status"] == "Applied"


def test_legacy_application_matches_exact_normalized_company_and_role(
	recruiter_offers_client,
) -> None:
	client, jobs, applications = recruiter_offers_client

	result = _applicants(client, jobs["legacy"])

	assert [applicant["application_id"] for applicant in result["applicants"]] == [
		applications["legacy"]
	]
	assert result["applicants"][0]["job_title"] == " data analyst "


def test_legacy_application_with_different_company_or_role_is_excluded(
	recruiter_offers_client,
) -> None:
	client, jobs, _applications = recruiter_offers_client

	result = _applicants(client, jobs["legacy"])

	names = {applicant["student_name"] for applicant in result["applicants"]}
	assert "Wrong Company" not in names
	assert "Wrong Role" not in names


def test_ambiguous_legacy_match_is_excluded(recruiter_offers_client) -> None:
	client, jobs, applications = recruiter_offers_client

	result = _applicants(client, jobs["ambiguous"])

	assert result["applicants"] == []
	assert result["ambiguous_count"] == 1
	assert applications["ambiguous"] not in {
		applicant["application_id"] for applicant in result["applicants"]
	}


def test_application_with_existing_offer_is_not_returned(recruiter_offers_client) -> None:
	client, jobs, applications = recruiter_offers_client

	result = _applicants(client, jobs["legacy"])

	returned_ids = {applicant["application_id"] for applicant in result["applicants"]}
	assert applications["legacy"] in returned_ids
	assert applications["offered"] not in returned_ids


def test_offer_creation_preserves_legacy_application_id_and_job_link(
	recruiter_offers_client,
) -> None:
	client, jobs, applications = recruiter_offers_client

	response = client.post(
		"/api/v1/recruiter-portal/offers",
		headers=_headers(),
		json={
			"application_id": applications["legacy"],
			"recruiter_jd_id": jobs["legacy"],
			"offer_date": datetime.now(timezone.utc).isoformat(),
			"notes": "",
		},
	)

	assert response.status_code == 201
	assert response.json()["application_id"] == applications["legacy"]
	assert response.json()["recruiter_jd_id"] == jobs["legacy"]
	assert response.json()["application_status"] == "Applied"


def test_recruiter_offer_routes_remain_recruiter_only(recruiter_offers_client) -> None:
	client, jobs, _applications = recruiter_offers_client
	for email, role in (
		("student@example.com", "student"),
		("admin@example.com", "admin"),
	):
		headers = _headers(email, role)
		assert client.get(
			"/api/v1/recruiter-portal/offers/applicants",
			params={"recruiter_jd_id": jobs["direct"]},
			headers=headers,
		).status_code == 403
		assert client.get("/api/v1/recruiter-portal/offers", headers=headers).status_code == 403


def test_recruiter_offer_routes_require_authentication(recruiter_offers_client) -> None:
	client, jobs, _applications = recruiter_offers_client
	assert client.get(
		"/api/v1/recruiter-portal/offers/applicants",
		params={"recruiter_jd_id": jobs["direct"]},
	).status_code == 401
	assert client.get("/api/v1/recruiter-portal/offers").status_code == 401
