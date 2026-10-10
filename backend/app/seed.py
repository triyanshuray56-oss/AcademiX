from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import PlacementDrive, Student
from backend.app.schemas.scheduling import PlacementDriveCreate
from backend.app.schemas.student import StudentCreate

STUDENT_SEEDS: tuple[StudentCreate, ...] = (
    StudentCreate(
        name="Ananya Mohanty",
        email="ananya.mohanty@bput.ac.in",
        branch="CSE",
        cgpa=9.1,
        skills="Python, SQL, React, Data Structures",
        readiness_score=88,
        readiness_status="Highly Employable",
        mock_interview_score=86,
    ),
    StudentCreate(
        name="Ritwik Patnaik",
        email="ritwik.patnaik@bput.ac.in",
        branch="CSE",
        cgpa=8.4,
        skills="Java, Spring Boot, SQL, Data Structures",
        readiness_score=76,
        readiness_status="Ready",
        mock_interview_score=79,
    ),
    StudentCreate(
        name="Sushmita Das",
        email="sushmita.das@bput.ac.in",
        branch="ETC",
        cgpa=8.7,
        skills="Python, Embedded C, MATLAB, IoT",
        readiness_score=79,
        readiness_status="Ready",
        mock_interview_score=82,
    ),
    StudentCreate(
        name="Aman Kumar",
        email="aman.kumar@bput.ac.in",
        branch="CSE",
        cgpa=7.2,
        skills="Java, HTML, CSS, SQL",
        readiness_score=55,
        readiness_status="Developing",
        mock_interview_score=58,
    ),
    StudentCreate(
        name="Priya Sahoo",
        email="priya.sahoo@bput.ac.in",
        branch="ETC",
        cgpa=9.3,
        skills="C++, VLSI, Verilog, Python",
        readiness_score=92,
        readiness_status="Highly Employable",
        mock_interview_score=91,
    ),
    StudentCreate(
        name="Debasish Nayak",
        email="debasish.nayak@bput.ac.in",
        branch="CSE",
        cgpa=6.8,
        skills="Python, DBMS, Git",
        readiness_score=43,
        readiness_status="Not Ready",
        mock_interview_score=46,
    ),
    StudentCreate(
        name="Isha Pradhan",
        email="isha.pradhan@bput.ac.in",
        branch="CSE",
        cgpa=8.0,
        skills="C++, Data Structures, Operating Systems, SQL",
        readiness_score=68,
        readiness_status="Developing",
        mock_interview_score=72,
    ),
    StudentCreate(
        name="Soumya Ranjan",
        email="soumya.ranjan@bput.ac.in",
        branch="ETC",
        cgpa=7.9,
        skills="Verilog, Embedded C, Digital Electronics, IoT",
        readiness_score=64,
        readiness_status="Developing",
        mock_interview_score=67,
    ),
    StudentCreate(
        name="Kunal Behera",
        email="kunal.behera@bput.ac.in",
        branch="CSE",
        cgpa=9.6,
        skills="Python, Machine Learning, Data Structures, FastAPI",
        readiness_score=96,
        readiness_status="Highly Employable",
        mock_interview_score=94,
    ),
    StudentCreate(
        name="Meera Jena",
        email="meera.jena@bput.ac.in",
        branch="ETC",
        cgpa=8.9,
        skills="Java, SQL, Computer Networks, Python",
        readiness_score=84,
        readiness_status="Ready",
        mock_interview_score=87,
    ),
)

PLACEMENT_DRIVE_SEEDS: tuple[PlacementDriveCreate, ...] = (
    PlacementDriveCreate(
        company_name="TCS",
        drive_date=datetime(2026, 10, 15, 10, 0),
        venue="BPUT Main Auditorium",
        status="Scheduled",
    ),
    PlacementDriveCreate(
        company_name="Infosys",
        drive_date=datetime(2026, 10, 15, 10, 0),
        venue="BPUT Main Auditorium",
        status="Conflicted",
    ),
    PlacementDriveCreate(
        company_name="Wipro",
        drive_date=datetime(2026, 10, 16, 10, 0),
        venue="BPUT Seminar Hall",
        status="Scheduled",
    ),
)


def seed_initial_data(db: Session) -> None:
    """Insert deterministic demo records without duplicating existing data."""
    existing_emails = set(db.scalars(select(Student.email)))
    existing_drives = set(
        db.execute(select(PlacementDrive.company_name, PlacementDrive.drive_date))
    )

    for student_seed in STUDENT_SEEDS:
        if student_seed.email not in existing_emails:
            db.add(Student(**student_seed.model_dump()))

    for drive_seed in PLACEMENT_DRIVE_SEEDS:
        key = (drive_seed.company_name, drive_seed.drive_date)
        if key not in existing_drives:
            db.add(PlacementDrive(**drive_seed.model_dump()))

    db.commit()


def seed_database(session: Session) -> None:
	"""Backward-compatible name for the startup seeder."""
	seed_initial_data(session)
