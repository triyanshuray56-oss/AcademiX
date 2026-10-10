"""Authenticated assessment proctoring and capability-based mobile pairing routes."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import AssessmentProctoringSession, AssessmentViolation, Student, User

router = APIRouter(prefix="/assessments", tags=["assessment proctoring"])
MAX_STRIKES = 3
STANDARD_PENALTY = 10.0
TAB_SWITCH_PENALTY = 50.0
LOOKING_AWAY_PENALTY = 15.0
MOBILE_PING_TIMEOUT = timedelta(seconds=10)

ViolationType = Literal[
    "NO_FACE",
    "MULTIPLE_FACES",
    "TAB_SWITCH",
    "FULLSCREEN_EXIT",
    "SECONDARY_CAM_DISCONNECTED",
    "LOOKING_AWAY",
]


class ViolationLog(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(min_length=1, max_length=40)
    assessment_id: str = Field(min_length=1, max_length=120)
    event_type: ViolationType
    timestamp: str = Field(min_length=1, max_length=80)
    strike_count: int = Field(ge=0)


class PairingSession(BaseModel):
    session_id: str
    mobile_connected: bool
    last_ping: str


class AssessmentSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: str = Field(min_length=1, max_length=120)


class MobilePingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=32, max_length=64)


class ViolationResult(BaseModel):
    current_strikes: int
    max_strikes: int
    auto_submit_triggered: bool
    trust_score: float
    penalty_reason: str


class SessionStatus(PairingSession):
    trust_score: float
    current_strikes: int
    assessment_id: str


def _student_for_user(db: Session, user: User) -> Student:
    student = db.scalar(select(Student).where(Student.email == user.email))
    if student is None:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _iso_timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat()


def _get_owned_session(db: Session, student_id: int, assessment_id: str) -> AssessmentProctoringSession:
    pairing = db.scalar(
        select(AssessmentProctoringSession).where(
            AssessmentProctoringSession.student_id == student_id,
            AssessmentProctoringSession.assessment_id == assessment_id,
        )
    )
    if pairing is None:
        raise HTTPException(status_code=404, detail="Assessment proctoring session not found")
    return pairing


@router.post("/sessions", response_model=PairingSession, status_code=status.HTTP_201_CREATED)
def create_proctoring_session(
    payload: AssessmentSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> PairingSession:
    """Create or resume the student's proctoring session for an assessment."""
    student = _student_for_user(db, current_user)
    existing = db.scalar(
        select(AssessmentProctoringSession).where(
            AssessmentProctoringSession.student_id == student.id,
            AssessmentProctoringSession.assessment_id == payload.assessment_id,
        )
    )
    if existing is not None:
        if existing.closed_at is not None:
            raise HTTPException(status_code=410, detail="Assessment proctoring session is closed")
        return PairingSession(
            session_id=existing.session_id,
            mobile_connected=_mobile_is_live(existing, _utc_now()),
            last_ping=_iso_timestamp(existing.last_ping),
        )

    now = _utc_now()
    pairing = AssessmentProctoringSession(
        session_id=secrets.token_urlsafe(32),
        student_id=student.id,
        assessment_id=payload.assessment_id,
        current_strikes=0,
        trust_score=100.0,
        mobile_connected=False,
        last_ping=now,
        created_at=now,
        auto_submit_triggered=False,
    )
    db.add(pairing)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        pairing = db.scalar(
            select(AssessmentProctoringSession).where(
                AssessmentProctoringSession.student_id == student.id,
                AssessmentProctoringSession.assessment_id == payload.assessment_id,
            )
        )
        if pairing is None:
            raise
        return PairingSession(
            session_id=pairing.session_id,
            mobile_connected=_mobile_is_live(pairing, _utc_now()),
            last_ping=_iso_timestamp(pairing.last_ping),
        )
    return PairingSession(session_id=pairing.session_id, mobile_connected=False, last_ping=_iso_timestamp(now))


def _mobile_is_live(pairing: AssessmentProctoringSession, now: datetime) -> bool:
    last_ping = pairing.last_ping
    if last_ping.tzinfo is None:
        last_ping = last_ping.replace(tzinfo=UTC)
    return pairing.mobile_connected and now - last_ping <= MOBILE_PING_TIMEOUT


@router.post("/log-violation", response_model=ViolationResult)
def log_violation(
    payload: ViolationLog,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> ViolationResult:
    """Persist an authenticated student's violation and apply server-side penalties."""
    student = _student_for_user(db, current_user)
    if payload.student_id != str(student.id):
        raise HTTPException(status_code=403, detail="Student identity does not match the authenticated account")

    pairing = _get_owned_session(db, student.id, payload.assessment_id)
    if pairing.auto_submit_triggered:
        return ViolationResult(
            current_strikes=pairing.current_strikes,
            max_strikes=MAX_STRIKES,
            auto_submit_triggered=True,
            trust_score=pairing.trust_score,
            penalty_reason="Assessment has already reached the proctoring submission threshold.",
        )
    if pairing.closed_at is not None:
        raise HTTPException(status_code=410, detail="Assessment proctoring session is closed")

    occurred_at = _utc_now()
    pairing.current_strikes += 1
    if payload.event_type == "TAB_SWITCH":
        penalty = TAB_SWITCH_PENALTY
        reason = "Tab switch detected: 50 trust points deducted."
    elif payload.event_type == "LOOKING_AWAY":
        penalty = LOOKING_AWAY_PENALTY
        reason = "Sustained looking away detected: 15 trust points deducted."
    else:
        penalty = STANDARD_PENALTY
        reason = f"{payload.event_type.replace('_', ' ').title()} detected: 10 trust points deducted."
    pairing.trust_score = max(0.0, pairing.trust_score - penalty)
    pairing.auto_submit_triggered = pairing.current_strikes >= MAX_STRIKES or pairing.trust_score <= 0
    db.add(AssessmentViolation(
        session_id=pairing.session_id,
        event_type=payload.event_type,
        timestamp=occurred_at,
        strike_count=pairing.current_strikes,
    ))
    db.commit()
    return ViolationResult(
        current_strikes=pairing.current_strikes,
        max_strikes=MAX_STRIKES,
        auto_submit_triggered=pairing.auto_submit_triggered,
        trust_score=pairing.trust_score,
        penalty_reason=reason,
    )


@router.post("/mobile-ping", response_model=PairingSession)
def mobile_ping(
    payload: MobilePingRequest,
    db: Session = Depends(get_db),
) -> PairingSession:
    """Refresh pairing liveness; possession of the random session ID authorizes this endpoint."""
    pairing = db.scalar(
        select(AssessmentProctoringSession).where(
            AssessmentProctoringSession.session_id == payload.session_id,
        )
    )
    if pairing is None:
        raise HTTPException(status_code=404, detail="Proctoring pairing session not found")
    if pairing.closed_at is not None:
        raise HTTPException(status_code=410, detail="Proctoring pairing session is closed")
    pairing.mobile_connected = True
    pairing.last_ping = _utc_now()
    db.commit()
    return PairingSession(
        session_id=pairing.session_id,
        mobile_connected=True,
        last_ping=_iso_timestamp(pairing.last_ping),
    )


@router.get("/session-status/{session_id}", response_model=SessionStatus)
def get_session_status(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> SessionStatus:
    """Return mobile pairing liveness and current trust state to the session owner."""
    student = _student_for_user(db, current_user)
    pairing = db.scalar(
        select(AssessmentProctoringSession).where(
            AssessmentProctoringSession.session_id == session_id,
            AssessmentProctoringSession.student_id == student.id,
        )
    )
    if pairing is None:
        raise HTTPException(status_code=404, detail="Proctoring pairing session not found")
    pairing.mobile_connected = _mobile_is_live(pairing, _utc_now())
    db.commit()
    return SessionStatus(
        session_id=pairing.session_id,
        mobile_connected=pairing.mobile_connected,
        last_ping=_iso_timestamp(pairing.last_ping),
        trust_score=pairing.trust_score,
        current_strikes=pairing.current_strikes,
        assessment_id=pairing.assessment_id,
    )


@router.post("/sessions/{session_id}/close")
def close_proctoring_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> dict[str, bool]:
    """Close the owner's pairing capability when the assessment ends."""
    student = _student_for_user(db, current_user)
    pairing = db.scalar(
        select(AssessmentProctoringSession).where(
            AssessmentProctoringSession.session_id == session_id,
            AssessmentProctoringSession.student_id == student.id,
        )
    )
    if pairing is None:
        raise HTTPException(status_code=404, detail="Proctoring pairing session not found")
    pairing.closed_at = pairing.closed_at or _utc_now()
    pairing.mobile_connected = False
    db.commit()
    return {"closed": True}
