from collections import defaultdict
from datetime import datetime, timedelta
import os
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import MatchRecord, PlacementDrive, RecruiterJD
from backend.app.schemas.api import DriveConflict, DriveListResponse, MessageResponse
from backend.app.schemas.scheduling import (
	PlacementDrive as PlacementDriveResponse,
	PlacementDriveCreate,
	PlacementDriveUpdate,
)
from backend.app.services.conflict_engine import ConflictEngine

router = APIRouter(prefix="/drives", tags=["drives"])
ACTIVE_DRIVE_STATUSES = ("Scheduled", "Conflicted")


@router.get("", response_model=DriveListResponse)
def list_drives(session: Session = Depends(get_db)) -> DriveListResponse:
	"""List active drives and report schedule and shortlisted-student conflicts."""
	drives = _load_active_drives(session)
	return DriveListResponse(drives=drives, conflicts=_detect_conflicts(session, drives))


@router.get("/conflicts", response_model=list[DriveConflict])
def list_drive_conflicts(session: Session = Depends(get_db)) -> list[DriveConflict]:
	"""Return active-drive conflicts with rescheduling suggestions."""
	drives = _load_active_drives(session)
	return _detect_conflicts(session, drives)


@router.get("/{drive_id}", response_model=PlacementDriveResponse)
def get_drive(drive_id: int, session: Session = Depends(get_db)) -> PlacementDrive:
	drive = session.get(PlacementDrive, drive_id)
	if drive is None:
		raise HTTPException(status_code=404, detail="Placement drive not found")
	return drive


@router.post("", response_model=PlacementDriveResponse, status_code=201)
def create_drive(
	payload: PlacementDriveCreate,
	session: Session = Depends(get_db),
) -> PlacementDrive:
	drive = PlacementDrive(**payload.model_dump())
	session.add(drive)
	session.commit()
	session.refresh(drive)
	return drive


@router.put("/{drive_id}", response_model=PlacementDriveResponse)
def update_drive(
	drive_id: int,
	payload: PlacementDriveUpdate,
	session: Session = Depends(get_db),
) -> PlacementDrive:
	drive = session.get(PlacementDrive, drive_id)
	if drive is None:
		raise HTTPException(status_code=404, detail="Placement drive not found")
	for field_name, value in payload.model_dump(exclude_unset=True).items():
		setattr(drive, field_name, value)
	session.commit()
	session.refresh(drive)
	return drive


@router.delete("/{drive_id}", response_model=MessageResponse)
def delete_drive(drive_id: int, session: Session = Depends(get_db)) -> MessageResponse:
	drive = session.get(PlacementDrive, drive_id)
	if drive is None:
		raise HTTPException(status_code=404, detail="Placement drive not found")
	session.delete(drive)
	session.commit()
	return MessageResponse(detail="Placement drive deleted")


def _load_active_drives(session: Session) -> list[PlacementDrive]:
	drives = list(
		session.scalars(
			select(PlacementDrive)
			.where(PlacementDrive.status.in_(ACTIVE_DRIVE_STATUSES))
			.order_by(PlacementDrive.drive_date, PlacementDrive.id)
		)
	)
	if not drives and os.getenv("APP_ENV", "development").casefold() != "production":
		if session.scalar(select(PlacementDrive.id).limit(1)) is None:
			now = datetime.now().replace(second=0, microsecond=0)
			return [
				SimpleNamespace(id=-1, company_name="TCS", drive_date=now + timedelta(days=3), venue="BPUT Placement Cell", status="Scheduled"),
				SimpleNamespace(id=-2, company_name="Infosys", drive_date=now + timedelta(days=7), venue="BPUT Placement Cell", status="Scheduled"),
				SimpleNamespace(id=-3, company_name="Wipro", drive_date=now + timedelta(days=12), venue="BPUT Placement Cell", status="Scheduled"),
				SimpleNamespace(id=-4, company_name="Accenture", drive_date=now + timedelta(days=15), venue="Virtual - BPUT Placement Cell", status="Scheduled"),
				SimpleNamespace(id=-5, company_name="Amazon", drive_date=now + timedelta(days=18), venue="BPUT Main Auditorium", status="Scheduled"),
				SimpleNamespace(id=-6, company_name="Deloitte", drive_date=now + timedelta(days=22), venue="BPUT Seminar Hall", status="Scheduled"),
			]
	return drives


def _detect_conflicts(
	session: Session,
	drives: list[PlacementDrive],
) -> list[DriveConflict]:
	company_students: dict[str, set[int]] = defaultdict(set)
	shortlisted_rows = session.execute(
		select(MatchRecord.student_id, RecruiterJD.company_name)
		.join(RecruiterJD, MatchRecord.jd_id == RecruiterJD.id)
		.where(MatchRecord.status == "In-Progress")
	)
	for student_id, company_name in shortlisted_rows:
		company_students[company_name.strip().casefold()].add(student_id)

	conflict_inputs = [
		{
			"id": drive.id,
			"company_name": drive.company_name,
			"drive_date": drive.drive_date,
			"venue": drive.venue,
			"status": drive.status,
			"shortlisted_student_ids": company_students[
				drive.company_name.strip().casefold()
			],
		}
		for drive in drives
	]
	conflicts = ConflictEngine().check_drive_conflicts(conflict_inputs)
	return [DriveConflict.model_validate(conflict) for conflict in conflicts]
