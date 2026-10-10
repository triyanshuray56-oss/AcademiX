import unittest
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.api.routes.assessment_proctor import (
    AssessmentSessionCreate,
    MobilePingRequest,
    ViolationLog,
    close_proctoring_session,
    create_proctoring_session,
    get_session_status,
    log_violation,
    mobile_ping,
)
from backend.app.database import Base
from backend.app.models import Student, User


class AssessmentProctorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.student = Student(
            name="Test Student",
            email="student@example.com",
            branch="CSE",
            cgpa=8.0,
            skills="Python",
        )
        self.user = User(
            email="student@example.com",
            hashed_password="not-a-real-password-hash",
            role="student",
            is_active=True,
        )
        self.db.add_all([self.student, self.user])
        self.db.commit()
        self.pairing = create_proctoring_session(
            AssessmentSessionCreate(assessment_id="assessment-test"),
            self.db,
            self.user,
        )

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _violation(self, event_type: str):
        return log_violation(
            ViolationLog(
                student_id=str(self.student.id),
                assessment_id="assessment-test",
                event_type=event_type,
                timestamp=datetime.now(UTC).isoformat(),
                strike_count=0,
            ),
            self.db,
            self.user,
        )

    def test_tab_switch_applies_exact_fifty_point_penalty(self) -> None:
        result = self._violation("TAB_SWITCH")

        self.assertEqual(result.trust_score, 50.0)
        self.assertEqual(result.current_strikes, 1)
        self.assertFalse(result.auto_submit_triggered)
        self.assertIn("50", result.penalty_reason)

    def test_other_events_apply_standard_penalty_and_three_strikes_submit(self) -> None:
        self.assertEqual(self._violation("NO_FACE").trust_score, 90.0)
        self.assertEqual(self._violation("MULTIPLE_FACES").trust_score, 80.0)
        final_result = self._violation("FULLSCREEN_EXIT")

        self.assertEqual(final_result.current_strikes, 3)
        self.assertTrue(final_result.auto_submit_triggered)
        self.assertEqual(final_result.trust_score, 70.0)

    def test_zero_trust_triggers_submission_before_three_strikes(self) -> None:
        self._violation("TAB_SWITCH")
        result = self._violation("TAB_SWITCH")

        self.assertEqual(result.current_strikes, 2)
        self.assertEqual(result.trust_score, 0.0)
        self.assertTrue(result.auto_submit_triggered)

    def test_looking_away_deducts_fifteen_points_and_repeated_calls_add_strikes(self) -> None:
        first = self._violation("LOOKING_AWAY")
        second = self._violation("LOOKING_AWAY")

        self.assertEqual(first.trust_score, 85.0)
        self.assertEqual(first.current_strikes, 1)
        self.assertIn("15", first.penalty_reason)
        self.assertEqual(second.trust_score, 70.0)
        self.assertEqual(second.current_strikes, 2)

    def test_violation_cannot_be_logged_for_another_student(self) -> None:
        payload = ViolationLog(
            student_id="999",
            assessment_id="assessment-test",
            event_type="TAB_SWITCH",
            timestamp=datetime.now(UTC).isoformat(),
            strike_count=0,
        )
        with self.assertRaises(HTTPException) as raised:
            log_violation(payload, self.db, self.user)

        self.assertEqual(raised.exception.status_code, 403)

    def test_mobile_ping_updates_owner_status(self) -> None:
        ping = mobile_ping(MobilePingRequest(session_id=self.pairing.session_id), self.db)
        state = get_session_status(self.pairing.session_id, self.db, self.user)

        self.assertTrue(ping.mobile_connected)
        self.assertTrue(state.mobile_connected)
        self.assertEqual(state.assessment_id, "assessment-test")
        self.assertEqual(state.current_strikes, 0)

    def test_creating_same_assessment_session_is_idempotent(self) -> None:
        resumed = create_proctoring_session(
            AssessmentSessionCreate(assessment_id="assessment-test"),
            self.db,
            self.user,
        )

        self.assertEqual(resumed.session_id, self.pairing.session_id)
        self.assertEqual(resumed.last_ping, self.pairing.last_ping)

    def test_closing_session_revokes_mobile_pairing_capability(self) -> None:
        result = close_proctoring_session(self.pairing.session_id, self.db, self.user)

        self.assertEqual(result, {"closed": True})
        with self.assertRaises(HTTPException) as raised:
            mobile_ping(MobilePingRequest(session_id=self.pairing.session_id), self.db)
        self.assertEqual(raised.exception.status_code, 410)


if __name__ == "__main__":
    unittest.main()
