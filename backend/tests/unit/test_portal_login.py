import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.auth import router as auth_router
from backend.app.core.security import get_password_hash
from backend.app.database import Base, get_db
from backend.app.models import User


@pytest.fixture
def auth_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all(
            User(
                email=f"{role}@example.com",
                hashed_password=get_password_hash("secure-password"),
                role=role,
                is_active=True,
            )
            for role in ("student", "recruiter", "admin")
        )
        db.commit()

    def override_get_db():
        with Session(engine) as db:
            yield db

    app = FastAPI()
    app.include_router(auth_router, prefix="/api")
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    engine.dispose()


@pytest.mark.parametrize("role", ["student", "recruiter", "admin"])
def test_portal_login_requires_matching_account_role(auth_client: TestClient, role: str) -> None:
    response = auth_client.post(
        "/api/auth/login",
        json={
            "email": f"{role}@example.com",
            "password": "secure-password",
            "expected_role": role,
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == role

    wrong_role = "admin" if role != "admin" else "student"
    denied = auth_client.post(
        "/api/auth/login",
        json={
            "email": f"{role}@example.com",
            "password": "secure-password",
            "expected_role": wrong_role,
        },
    )
    assert denied.status_code == 403
    assert f"registered as a {'HR / Recruiter' if role == 'recruiter' else role.title()}" in denied.json()["detail"]
    assert "Please use the" in denied.json()["detail"]


def test_portal_login_does_not_disclose_account_role_for_bad_password(
    auth_client: TestClient,
) -> None:
    response = auth_client.post(
        "/api/auth/login",
        json={
            "email": "student@example.com",
            "password": "incorrect-password",
            "expected_role": "admin",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_portal_login_requires_valid_expected_role(auth_client: TestClient) -> None:
    missing_role = auth_client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": "secure-password"},
    )
    invalid_role = auth_client.post(
        "/api/auth/login",
        json={
            "email": "student@example.com",
            "password": "secure-password",
            "expected_role": "superuser",
        },
    )
    assert missing_role.status_code == 422
    assert invalid_role.status_code == 422


def test_form_login_requires_and_checks_expected_role(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/auth/login",
        data={
            "username": "recruiter@example.com",
            "password": "secure-password",
            "expected_role": "recruiter",
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == "recruiter"
