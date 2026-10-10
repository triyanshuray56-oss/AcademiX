import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.api.v1.messages import (
    RespondToRequest,
    SendMessage,
    get_connection_requests,
    get_admin_message_threads,
    get_message_threads,
    get_recruiter_message_threads,
    respond_to_connection_request,
    send_direct_message,
)
from backend.app.database import Base
from backend.app.models import CandidateConnection, DirectMessage, User


class MessageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.student = User(
            email="student@example.com",
            hashed_password="not-a-real-password-hash",
            role="student",
            is_active=True,
        )
        self.recruiter = User(
            email="recruiter@example.com",
            hashed_password="not-a-real-password-hash",
            role="recruiter",
            is_active=True,
        )
        self.other_student = User(
            email="other@example.com",
            hashed_password="not-a-real-password-hash",
            role="student",
            is_active=True,
        )
        self.db.add_all([self.student, self.recruiter, self.other_student])
        self.db.commit()
        self.connection = CandidateConnection(
            sender_id=self.recruiter.id,
            recipient_id=self.student.id,
            sender_role="recruiter",
            status="pending",
            opportunity_title="Software Engineer",
            intro_message="Let's connect.",
        )
        self.db.add(self.connection)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_requests_are_limited_to_the_authenticated_student(self) -> None:
        self.assertEqual(
            [request.id for request in get_connection_requests(self.db, self.student)],
            [self.connection.id],
        )
        self.assertEqual(get_connection_requests(self.db, self.other_student), [])

    def test_accepting_connection_unlocks_two_way_thread_only_for_participants(self) -> None:
        respond_to_connection_request(
            self.connection.id,
            RespondToRequest(status="accepted"),
            self.db,
            self.student,
        )
        sent = send_direct_message(
            SendMessage(connection_id=self.connection.id, content="Hello there"),
            self.db,
            self.student,
        )
        self.assertEqual(sent.sender_email, self.student.email)
        recruiter_thread = get_message_threads(self.db, self.recruiter)[0]
        student_thread = get_message_threads(self.db, self.student)[0]
        for thread in (recruiter_thread, student_thread):
            self.assertEqual(
                [message.content for message in thread.messages],
                ["Let's connect.", "Hello there"],
            )
            self.assertEqual(thread.messages[0].sender_email, self.recruiter.email)
            self.assertLessEqual(thread.messages[0].timestamp, thread.messages[1].timestamp)
        with self.assertRaises(HTTPException) as raised:
            send_direct_message(
                SendMessage(connection_id=self.connection.id, content="Not allowed"),
                self.db,
                self.other_student,
            )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.db.query(DirectMessage).count(), 1)

    def test_pending_or_foreign_requests_cannot_be_answered_or_messaged(self) -> None:
        with self.assertRaises(HTTPException) as foreign:
            respond_to_connection_request(
                self.connection.id,
                RespondToRequest(status="accepted"),
                self.db,
                self.other_student,
            )
        self.assertEqual(foreign.exception.status_code, 404)
        with self.assertRaises(HTTPException) as pending:
            send_direct_message(
                SendMessage(connection_id=self.connection.id, content="Not yet"),
                self.db,
                self.student,
            )
        self.assertEqual(pending.exception.status_code, 409)
        self.assertEqual(get_message_threads(self.db, self.student), [])

    def test_staff_outbox_includes_pending_and_connected_requests_for_sender(self) -> None:
        pending_threads = get_recruiter_message_threads(self.db, self.recruiter)
        self.assertEqual(len(pending_threads), 1)
        self.assertEqual(pending_threads[0].status, "pending")
        self.assertEqual(pending_threads[0].other_party_email, self.student.email)

        respond_to_connection_request(
            self.connection.id,
            RespondToRequest(status="accepted"),
            self.db,
            self.student,
        )
        self.assertEqual(get_recruiter_message_threads(self.db, self.recruiter)[0].status, "accepted")
        self.assertEqual(get_admin_message_threads(self.db, self.other_student), [])


if __name__ == "__main__":
    unittest.main()
