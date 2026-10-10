import unittest
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.api.v1.community import (
    _leaderboard,
    get_recruiter_discovery,
    router as community_router,
    get_talent_pool,
    send_direct_connect,
)
from backend.app.core.security import get_current_user
from backend.app.database import Base, get_db
from backend.app.models import (
    CandidateConnection,
    DirectConnectInvite,
    Student,
    StudentGrowthSnapshot,
    User,
)
from backend.app.schemas.community import DirectScoutAction, RecruiterScoutFilter


class CommunityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.student = Student(
            name="Ready Student",
            email="ready@example.com",
            branch="CSE",
            cgpa=8.6,
            skills="React, algorithms",
            readiness_score=90,
            readiness_status="Ready",
            mock_interview_score=88,
            coding_score=92,
            onboarding_complete=True,
            verified_tech_stack=["React", "Data Structures"],
        )
        self.recruiter = User(
            email="recruiter@example.com",
            hashed_password="not-a-real-password-hash",
            role="recruiter",
            is_active=True,
        )
        self.student_user = User(
            email=self.student.email,
            hashed_password="not-a-real-password-hash",
            role="student",
            is_active=True,
        )
        self.db.add_all([self.student, self.recruiter, self.student_user])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_empty_database_leaderboard_returns_curated_demo_profiles(self) -> None:
        self.db.query(Student).delete()
        self.db.commit()

        candidates = _leaderboard(self.db, "All", "all_time", 20)

        self.assertGreaterEqual(len(candidates), 10)
        self.assertTrue(all(candidate.student_id.startswith("demo-") for candidate in candidates))
        self.assertEqual([candidate.rank for candidate in candidates], list(range(1, len(candidates) + 1)))
        self.assertTrue(any(candidate.college_name == "ABIT" for candidate in candidates))

    def test_leaderboard_filters_domain_and_hire_ready_talent(self) -> None:
        candidates = get_talent_pool(
            RecruiterScoutFilter(domain="React / Frontend", min_score=80, hire_ready_only=True, limit=20),
            self.db,
        )

        self.assertTrue(candidates)
        self.assertTrue(all(candidate.global_score >= 80 for candidate in candidates))
        self.assertTrue(all("Hire Ready" in candidate.badges for candidate in candidates))

    def test_recruiter_discovery_uses_real_profiles_and_snapshot_growth(self) -> None:
        self.db.add_all([
            StudentGrowthSnapshot(
                student_id=self.student.id,
                date=date(2026, 10, 1),
                readiness_score=70,
                leetcode_rating=1200,
                cgpa=8.6,
                project_count=1,
                interview_score=80,
                profile_completeness=70,
            ),
            StudentGrowthSnapshot(
                student_id=self.student.id,
                date=date(2026, 10, 8),
                readiness_score=82,
                leetcode_rating=1300,
                cgpa=8.6,
                project_count=2,
                interview_score=85,
                profile_completeness=80,
            ),
        ])
        self.db.commit()

        candidates = get_recruiter_discovery(self.db)

        self.assertEqual(len(candidates), 1)
        candidate = candidates[0]
        self.assertEqual(candidate.student_id, str(self.student.id))
        self.assertEqual(candidate.name, self.student.name)
        self.assertEqual(candidate.branch, "CSE")
        self.assertEqual(candidate.talent_score, 90)
        self.assertEqual(candidate.technical_score, 92)
        self.assertIn("React", candidate.skills)
        self.assertEqual(candidate.previous_readiness, 70)
        self.assertEqual(candidate.current_readiness, 82)
        self.assertEqual(candidate.readiness_change, 12)
        self.assertEqual(candidate.previous_snapshot_date, "2026-10-01")
        self.assertEqual(candidate.current_snapshot_date, "2026-10-08")
        self.assertFalse(hasattr(candidate, "email"))

    def test_recruiter_discovery_has_no_synthetic_profiles_or_fake_growth(self) -> None:
        incomplete_student = Student(
            name="Incomplete Student",
            email="incomplete@example.com",
            branch="ECE",
            cgpa=7.5,
            skills="Python",
            onboarding_complete=False,
        )
        self.db.add(incomplete_student)
        self.db.commit()

        candidates = get_recruiter_discovery(self.db)

        self.assertEqual([candidate.student_id for candidate in candidates], [str(self.student.id)])
        self.assertIsNone(candidates[0].readiness_change)
        self.assertIsNone(candidates[0].previous_readiness)

    def test_recruiter_discovery_api_requires_recruiter_role(self) -> None:
        app = FastAPI()
        app.include_router(community_router, prefix="/v1")
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.recruiter

        with TestClient(app) as client:
            self.assertEqual(client.get("/v1/community/recruiter-discovery").status_code, 200)

            app.dependency_overrides[get_current_user] = lambda: self.student_user
            self.assertEqual(client.get("/v1/community/recruiter-discovery").status_code, 403)

            app.dependency_overrides.pop(get_current_user)
            self.assertEqual(client.get("/v1/community/recruiter-discovery").status_code, 401)

    def test_direct_connect_requires_authenticated_recruiter_identity(self) -> None:
        payload = DirectScoutAction(
            recruiter_id="different@example.com",
            student_id=str(self.student.id),
            opportunity_title="Frontend Engineer",
            message="Let's talk.",
        )

        with self.assertRaises(HTTPException) as raised:
            send_direct_connect(payload, self.db, self.recruiter)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(self.db.query(DirectConnectInvite).count(), 0)

    def test_direct_connect_persists_invite_for_real_student(self) -> None:
        payload = DirectScoutAction(
            recruiter_id=self.recruiter.email,
            student_id=str(self.student.id),
            opportunity_title="Frontend Engineer",
            message="Let's talk about your React experience.",
        )

        result = send_direct_connect(payload, self.db, self.recruiter)

        self.assertEqual(result.status, "sent")
        self.assertEqual(result.message, "Your direct interview invitation has been sent.")
        self.assertEqual(
            self.db.query(DirectConnectInvite).count(), 1
        )
        connection = self.db.query(CandidateConnection).one()
        self.assertEqual(connection.sender_id, self.recruiter.id)
        self.assertEqual(connection.recipient_id, self.student_user.id)
        self.assertEqual(connection.sender_role, "recruiter")
        self.assertEqual(connection.status, "pending")


if __name__ == "__main__":
    unittest.main()
