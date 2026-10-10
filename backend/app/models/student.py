from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Float, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint(
            "readiness_status IN ('Not Ready', 'Developing', 'Ready', 'Highly Employable')",
            name="ck_students_readiness_status",
        ),
        CheckConstraint(
            "active_backlogs >= 0 AND cleared_backlogs >= 0",
            name="ck_students_backlog_counts",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    branch: Mapped[str] = mapped_column(String(40), nullable=False)
    cgpa: Mapped[float] = mapped_column(Float, nullable=False)
    skills: Mapped[str] = mapped_column(Text, nullable=False, default="")
    readiness_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    readiness_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Not Ready"
    )
    mock_interview_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    flight_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    qr_auth_token: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    semester_cgpas: Mapped[list[float | None]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    active_backlogs: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    cleared_backlogs: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    tenth_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    twelfth_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    university_roll_number: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    branch_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    branch_percentile: Mapped[float | None] = mapped_column(Float, nullable=True)

    leetcode_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    hackerrank_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    coding_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    system_design_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    verified_tech_stack: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )

    ai_speech_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    aptitude_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    leadership_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    internship_experiences: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    mentor_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    project_showcase: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    responsibilities: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    accomplishments: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    volunteering: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    extracurriculars: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    resume_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resume_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_picture_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    documents_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    college_id_card_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    college_id_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    match_records: Mapped[list["MatchRecord"]] = relationship(back_populates="student")
    applications: Mapped[list["StudentApplication"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    growth_snapshots: Mapped[list["StudentGrowthSnapshot"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
