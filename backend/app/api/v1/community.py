"""Direct student community leaderboard and recruiter scouting API."""

import logging
import re
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user, require_roles
from backend.app.database import get_db
from backend.app.models import (
    AssessmentProctoringSession,
    CandidateConnection,
    DirectConnectInvite,
    Student,
    StudentGrowthSnapshot,
    User,
)
from backend.app.schemas.community import (
    DirectConnectResult,
    DirectScoutAction,
    RecruiterTalentItem,
    RecruiterScoutFilter,
    StudentRankItem,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/community", tags=["student community"])

DOMAIN_TERMS = {
    "DSA Masters": ("dsa", "algorithm", "data structure", "problem solving", "leetcode"),
    "React / Frontend": ("react", "frontend", "javascript", "typescript", "ui", "css"),
    "Aptitude": ("aptitude", "quantitative", "logical reasoning"),
}

DEMO_PROFILES = [
    ("Aarav Sen", "ABIT", "Backend Engineer", 98, 142, 38, 98.0, ["Hire Ready", "DSA Master", "Verified Proctor"]),
    ("Ishita Das", "BPUT", "Frontend Engineer", 96, 128, 31, 97.0, ["Hire Ready", "React Specialist", "Verified Proctor"]),
    ("Rohan Patnaik", "IIT Bhubaneswar", "Software Engineer", 95, 119, 29, 96.0, ["Hire Ready", "DSA Master"]),
    ("Meera Nair", "NIT Rourkela", "Data Analyst", 93, 104, 25, 98.0, ["Hire Ready", "Aptitude Ace", "Verified Proctor"]),
    ("Devansh Rao", "ABIT", "Full-stack Engineer", 91, 98, 23, 95.0, ["Hire Ready", "React Specialist"]),
    ("Ananya Mishra", "BPUT", "Software Engineer", 90, 92, 22, 94.0, ["DSA Master", "Verified Proctor"]),
    ("Kabir Mohanty", "NIT Rourkela", "Frontend Engineer", 88, 85, 20, 97.0, ["React Specialist", "Verified Proctor"]),
    ("Saanvi Roy", "IIT Bhubaneswar", "Product Analyst", 86, 77, 18, 96.0, ["Aptitude Ace", "Hire Ready"]),
    ("Aditya Behera", "ABIT", "Backend Engineer", 84, 72, 17, 92.0, ["DSA Master"]),
    ("Priya Kulkarni", "BPUT", "Frontend Engineer", 82, 66, 15, 95.0, ["React Specialist", "Verified Proctor"]),
    ("Arjun Sahu", "NIT Rourkela", "Software Engineer", 80, 61, 14, 91.0, ["Aptitude Ace"]),
    ("Tara Fernandes", "IIT Bhubaneswar", "Data Engineer", 78, 56, 12, 93.0, ["Verified Proctor"]),
]


def _domain_match(candidate: StudentRankItem, domain: str | None) -> bool:
    if not domain or domain.casefold() in {"all", "all domains"}:
        return True
    if domain.casefold() == candidate.target_role.casefold():
        return True
    terms = next(
        (values for key, values in DOMAIN_TERMS.items() if key.casefold() == domain.casefold()),
        (domain.casefold(),),
    )
    searchable = " ".join((candidate.target_role, *candidate.badges)).casefold()
    return any(term in searchable for term in terms)


def _student_domain_match(student: Student, domain: str | None) -> bool:
    if not domain or domain.casefold() in {"all", "all domains"}:
        return True
    terms = next(
        (values for key, values in DOMAIN_TERMS.items() if key.casefold() == domain.casefold()),
        (domain.casefold(),),
    )
    searchable = " ".join(
        [student.branch, student.skills, *(student.verified_tech_stack or []), *[entry.get("name", "") for entry in student.project_showcase or []]]
    ).casefold()
    return any(term in searchable for term in terms)


def _target_role(student: Student) -> str:
    if student.verified_tech_stack:
        skills = " ".join(student.verified_tech_stack).casefold()
    else:
        skills = student.skills.casefold()
    if any(term in skills for term in ("react", "frontend", "javascript", "typescript")):
        return "Frontend Engineer"
    if any(term in skills for term in ("data", "sql", "analytics", "machine learning")):
        return "Data Analyst"
    if any(term in skills for term in ("backend", "fastapi", "django", "node")):
        return "Backend Engineer"
    return "Software Engineer"


def _score(student: Student) -> int:
    scores = [
        float(student.readiness_score or 0),
        float(student.mock_interview_score or 0),
        float(student.coding_score or 0),
    ]
    available = [score for score in scores if score > 0]
    return round(sum(available) / len(available)) if available else 0


def _live_trust(db: Session, student_id: int) -> float:
    sessions = list(db.scalars(
        select(AssessmentProctoringSession).where(AssessmentProctoringSession.student_id == student_id)
    ))
    return round(sum(session.trust_score for session in sessions) / len(sessions), 1) if sessions else 100.0


def _badges(student: Student, trust: float) -> list[str]:
    badges = []
    if student.readiness_status in {"Ready", "Highly Employable"}:
        badges.append("Hire Ready")
    if any("react" in skill.casefold() or "frontend" in skill.casefold() for skill in student.verified_tech_stack):
        badges.append("React Specialist")
    if any(term in f"{student.skills} {' '.join(student.verified_tech_stack)}".casefold() for term in ("algorithm", "data structure", "leetcode", "dsa")):
        badges.append("DSA Master")
    if (student.aptitude_score or 0) >= 75:
        badges.append("Aptitude Ace")
    if trust >= 90 and student.ai_speech_score is not None:
        badges.append("Verified Proctor")
    return badges


def _demo_candidates() -> list[StudentRankItem]:
    return [
        StudentRankItem(
            student_id=f"demo-{index}",
            name=name,
            college_name=college,
            avatar_url=None,
            target_role=target_role,
            global_score=score,
            rank=index,
            streak_days=streak,
            problems_solved=solved,
            badges=badges,
            proctoring_avg_trust=trust,
        )
        for index, (name, college, target_role, score, solved, streak, trust, badges)
        in enumerate(DEMO_PROFILES, start=1)
    ]


def _leaderboard(
    db: Session,
    domain: str | None,
    timeframe: Literal["weekly", "all_time"],
    limit: int,
) -> list[StudentRankItem]:
    students = [
        student
        for student in db.scalars(select(Student).where(Student.onboarding_complete.is_(True)))
        if _student_domain_match(student, domain)
    ]
    candidates = []
    for student in students:
        trust = _live_trust(db, student.id)
        candidates.append(StudentRankItem(
            student_id=str(student.id),
            name=student.name,
            college_name="BPUT Affiliated College",
            avatar_url=student.profile_picture_url,
            target_role=_target_role(student),
            global_score=_score(student),
            rank=1,
            streak_days=0,
            problems_solved=round((student.leetcode_rating or 0) / 15 + (student.hackerrank_rating or 0) / 20),
            badges=_badges(student, trust),
            proctoring_avg_trust=trust,
        ))
    if len(candidates) < 10:
        demos = [
            candidate
            for candidate in _demo_candidates()
            if _domain_match(candidate, domain)
        ]
        candidates.extend(demos[: 10 - len(candidates)])
    if timeframe == "weekly":
        candidates.sort(key=lambda candidate: (candidate.streak_days, candidate.global_score, candidate.problems_solved), reverse=True)
    else:
        candidates.sort(key=lambda candidate: (candidate.global_score, candidate.problems_solved, candidate.streak_days), reverse=True)
    ranked = [
        candidate.model_copy(update={"rank": index})
        for index, candidate in enumerate(candidates[:limit], start=1)
    ]
    return ranked


@router.get(
    "/leaderboard",
    response_model=list[StudentRankItem],
    dependencies=[Depends(get_current_user)],
)
def get_community_leaderboard(
    domain: str = Query(default="All", max_length=80),
    timeframe: Literal["weekly", "all_time"] = "all_time",
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[StudentRankItem]:
    """Show ranked real students with curated profiles to keep demos populated."""
    return _leaderboard(db, domain, timeframe, limit)


@router.get(
    "/talent-pool",
    response_model=list[StudentRankItem],
    dependencies=[Depends(require_roles("recruiter", "admin"))],
)
def get_talent_pool(
    filters: RecruiterScoutFilter = Depends(),
    db: Session = Depends(get_db),
) -> list[StudentRankItem]:
    """Return recruiter-only candidate profiles matching score and readiness filters."""
    candidates = _leaderboard(db, filters.domain, "all_time", 100)
    if filters.min_score is not None:
        candidates = [candidate for candidate in candidates if candidate.global_score >= filters.min_score]
    if filters.hire_ready_only:
        candidates = [candidate for candidate in candidates if "Hire Ready" in candidate.badges]
    return [
        candidate.model_copy(update={"rank": index})
        for index, candidate in enumerate(candidates[:filters.limit], start=1)
    ]


@router.get(
    "/recruiter-discovery",
    response_model=list[RecruiterTalentItem],
    dependencies=[Depends(require_roles("recruiter"))],
)
def get_recruiter_discovery(
    db: Session = Depends(get_db),
) -> list[RecruiterTalentItem]:
    """Return privacy-limited talent profiles for the recruiter discovery workspace."""
    students = list(db.scalars(
        select(Student).where(Student.onboarding_complete.is_(True))
    ))
    if not students:
        return []

    ranked_students = sorted(
        students,
        key=lambda student: (
            _score(student),
            round((student.leetcode_rating or 0) / 15 + (student.hackerrank_rating or 0) / 20),
        ),
        reverse=True,
    )
    ranks = {student.id: index for index, student in enumerate(ranked_students, start=1)}
    student_ids = [student.id for student in students]
    snapshots = list(db.scalars(
        select(StudentGrowthSnapshot)
        .where(StudentGrowthSnapshot.student_id.in_(student_ids))
        .order_by(StudentGrowthSnapshot.student_id, StudentGrowthSnapshot.date, StudentGrowthSnapshot.id)
    ))
    snapshots_by_student: dict[int, list[StudentGrowthSnapshot]] = {}
    for snapshot in snapshots:
        snapshots_by_student.setdefault(snapshot.student_id, []).append(snapshot)

    candidates = []
    for student in students:
        skills = []
        seen_skills = set()
        raw_skills = [
            *(student.verified_tech_stack or []),
            *(re.split(r"[,;|]", student.skills or "")),
        ]
        for raw_skill in raw_skills:
            skill = str(raw_skill).strip()
            normalized = skill.casefold()
            if skill and normalized not in seen_skills:
                skills.append(skill)
                seen_skills.add(normalized)

        student_snapshots = snapshots_by_student.get(student.id, [])
        previous_snapshot = student_snapshots[-2] if len(student_snapshots) >= 2 else None
        current_snapshot = student_snapshots[-1] if previous_snapshot else None
        previous_readiness = float(previous_snapshot.readiness_score) if previous_snapshot else None
        current_readiness = float(current_snapshot.readiness_score) if current_snapshot else None
        readiness_change = (
            round(current_readiness - previous_readiness, 1)
            if previous_readiness is not None and current_readiness is not None
            else None
        )
        project_count = len(student.project_showcase or [])
        technical_score = float(student.coding_score) if student.coding_score is not None else None
        badges = _badges(student, _live_trust(db, student.id))
        technical_summary = (
            f"Coding performance: {technical_score:g}/100"
            if technical_score is not None
            else "Coding performance: not recorded"
        )
        candidates.append(RecruiterTalentItem(
            student_id=str(student.id),
            name=student.name,
            branch=student.branch,
            target_role=_target_role(student),
            talent_score=_score(student),
            global_rank=ranks[student.id],
            technical_score=technical_score,
            skills=skills,
            badges=badges,
            project_count=project_count,
            summary=f"{technical_summary}; {len(skills)} listed skills; {project_count} showcased projects.",
            previous_readiness=previous_readiness,
            current_readiness=current_readiness,
            readiness_change=readiness_change,
            previous_snapshot_date=previous_snapshot.date.isoformat() if previous_snapshot else None,
            current_snapshot_date=current_snapshot.date.isoformat() if current_snapshot else None,
        ))
    return sorted(candidates, key=lambda candidate: candidate.global_rank)


@router.post("/direct-connect", response_model=DirectConnectResult, status_code=status.HTTP_201_CREATED)
def send_direct_connect(
    payload: DirectScoutAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("recruiter", "admin")),
) -> DirectConnectResult:
    """Persist a recruiter invitation to a real student, not a demo profile."""
    if payload.recruiter_id != current_user.email:
        raise HTTPException(status_code=403, detail="Recruiter identity does not match the authenticated account")
    if not payload.student_id.isdecimal():
        raise HTTPException(status_code=404, detail="Demo community profiles cannot receive invites")
    student = db.scalar(select(Student).where(Student.id == int(payload.student_id)))
    if student is None:
        raise HTTPException(status_code=404, detail="Student profile not found")
    recipient = db.scalar(select(User).where(User.email == student.email))
    if recipient is None or recipient.role != "student" or not recipient.is_active:
        raise HTTPException(status_code=409, detail="Student account is unavailable for a connection request")

    invite = DirectConnectInvite(
        recruiter_user_id=current_user.id,
        student_id=student.id,
        opportunity_title=payload.opportunity_title.strip(),
        message=payload.message.strip(),
        created_at=datetime.now(UTC),
        status="sent",
    )
    db.add(invite)
    connection = CandidateConnection(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        sender_role=current_user.role,
        status="pending",
        opportunity_title=payload.opportunity_title.strip(),
        intro_message=payload.message.strip(),
        created_at=datetime.now(UTC),
    )
    db.add(connection)
    db.commit()
    logger.info("Community direct-connect invitation %s created by recruiter %s", invite.id, current_user.id)
    return DirectConnectResult(
        invite_id=str(invite.id),
        status=invite.status,
        message="Your direct interview invitation has been sent.",
    )
