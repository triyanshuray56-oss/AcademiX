import os
from collections.abc import Generator
import logging

import backend.app.config  # noqa: F401  # load DATABASE_URL from local .env files
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def _database_url() -> str:
	raw_url = os.getenv("DATABASE_URL", "sqlite:///./campuslink.db")
	url = make_url(raw_url)
	if url.drivername in {"postgres", "postgresql"}:
		url = url.set(drivername="postgresql+psycopg")
	return url.render_as_string(hide_password=False)


DATABASE_URL = _database_url()
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
	pass


def get_db() -> Generator[Session, None, None]:
	session = SessionLocal()
	try:
		yield session
	finally:
		session.close()


def create_db_and_tables() -> None:
	import backend.app.models  # noqa: F401

	Base.metadata.create_all(bind=engine)
	if DATABASE_URL.startswith("sqlite"):
		_repair_local_growth_snapshot_schema()
		_repair_local_registration_deadline_schema()
		_repair_local_job_application_deadline_schema()
		_repair_local_recruiter_portal_schema()


def _repair_local_recruiter_portal_schema() -> None:
	"""Add recruiter portal fields to existing SQLite postings without replacing data."""
	table = "recruiter_jds"
	with engine.begin() as connection:
		inspector = inspect(connection)
		if not inspector.has_table(table):
			return
		columns = {column["name"] for column in inspector.get_columns(table)}
		for name, definition in {
			"job_category": "VARCHAR(20) NOT NULL DEFAULT 'job'",
			"description": "TEXT NOT NULL DEFAULT ''",
			"eligible_branches": "TEXT NOT NULL DEFAULT '[]'",
		}.items():
			if name not in columns:
				connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}')
		if "job_category" not in columns:
			connection.exec_driver_sql(
				f'UPDATE "{table}" SET "job_category" = \'internship\' WHERE lower("role_title") LIKE \'%intern%\''
			)


def _repair_local_job_application_deadline_schema() -> None:
	"""Add the optional application cutoff to legacy local recruiter listings."""
	table = "recruiter_jds"
	with engine.begin() as connection:
		inspector = inspect(connection)
		if not inspector.has_table(table):
			return
		columns = {column["name"] for column in inspector.get_columns(table)}
		if "application_deadline" not in columns:
			connection.exec_driver_sql(
				f'ALTER TABLE "{table}" ADD COLUMN "application_deadline" DATETIME'
			)
		connection.exec_driver_sql(
			f'CREATE INDEX IF NOT EXISTS "ix_recruiter_jds_application_deadline" ON "{table}" ("application_deadline")'
		)


def _repair_local_registration_deadline_schema() -> None:
	"""Add the nullable registration cutoff to legacy local SQLite databases."""
	table = "placement_drives"
	with engine.begin() as connection:
		inspector = inspect(connection)
		if not inspector.has_table(table):
			return
		columns = {column["name"] for column in inspector.get_columns(table)}
		if "registration_deadline" not in columns:
			connection.exec_driver_sql(
				f'ALTER TABLE "{table}" ADD COLUMN "registration_deadline" DATETIME'
			)
		connection.exec_driver_sql(
			f'CREATE INDEX IF NOT EXISTS "ix_placement_drives_registration_deadline" ON "{table}" ("registration_deadline")'
		)


def _repair_local_growth_snapshot_schema() -> None:
	"""Repair pre-migration SQLite growth tables without discarding snapshot data."""
	table = "student_growth_snapshots"
	with engine.begin() as connection:
		inspector = inspect(connection)
		if not inspector.has_table(table):
			return
		columns = {column["name"] for column in inspector.get_columns(table)}
		if "date" not in columns and "snapshot_date" in columns:
			connection.exec_driver_sql(
				f'ALTER TABLE "{table}" RENAME COLUMN "snapshot_date" TO "date"'
			)
			columns.remove("snapshot_date")
			columns.add("date")
			logger.info("Renamed legacy student_growth_snapshots.snapshot_date to date")
		if "date" not in columns:
			connection.exec_driver_sql(
				f'ALTER TABLE "{table}" ADD COLUMN "date" DATE'
			)
			connection.execute(text(
				f'UPDATE "{table}" SET "date" = CURRENT_DATE WHERE "date" IS NULL'
			))
			columns.add("date")
		missing_columns = {
			"student_id": "INTEGER",
			"readiness_score": "FLOAT NOT NULL DEFAULT 0",
			"leetcode_rating": "FLOAT",
			"cgpa": "FLOAT NOT NULL DEFAULT 0",
			"project_count": "INTEGER NOT NULL DEFAULT 0",
			"interview_score": "FLOAT NOT NULL DEFAULT 0",
			"profile_completeness": "FLOAT NOT NULL DEFAULT 0",
		}
		for name, definition in missing_columns.items():
			if name not in columns:
				connection.exec_driver_sql(
					f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}'
				)
				columns.add(name)
				logger.warning("Added missing local growth snapshot column %s", name)
		connection.exec_driver_sql(
			f'CREATE INDEX IF NOT EXISTS "ix_student_growth_snapshots_date" ON "{table}" ("date")'
		)
		connection.exec_driver_sql(
			f'CREATE INDEX IF NOT EXISTS "ix_student_growth_snapshots_student_id" ON "{table}" ("student_id")'
		)
		unique_constraints = inspect(connection).get_unique_constraints(table)
		has_student_day_constraint = any(
			set(constraint.get("column_names") or []) == {"student_id", "date"}
			for constraint in unique_constraints
		)
		if not has_student_day_constraint:
			duplicate = connection.execute(text(
				f'SELECT 1 FROM "{table}" GROUP BY "student_id", "date" HAVING COUNT(*) > 1 LIMIT 1'
			)).first()
			if duplicate is None:
				connection.exec_driver_sql(
					f'CREATE UNIQUE INDEX IF NOT EXISTS "uq_student_growth_student_date" ON "{table}" ("student_id", "date")'
				)
			else:
				logger.warning("Skipped local daily snapshot uniqueness index because legacy duplicate rows exist")
