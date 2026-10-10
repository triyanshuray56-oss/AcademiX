from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.ai.ai_engine import AIPlacementEngine
from backend.app.core.security import require_roles
from backend.app.database import get_db
from backend.app.models import MatchRecord, PlacementDrive, RecruiterJD, Student, User
from backend.app.schemas.api import MatchRunResponse
from backend.app.schemas.matching import MatchRecord as MatchRecordResponse
from backend.app.schemas.matching import RecruiterActionUpdate

router = APIRouter(prefix="/matching", tags=["matching"])
SHORTLIST_FIT_THRESHOLD = 70.0
RECRUITER_ACTION_STATUSES = {
	"Not Actioned",
	"Shortlisted",
	"Interview Scheduled",
	"Offer Extended",
}


@router.patch("/{match_id}/recruiter-action", response_model=MatchRecordResponse)
def update_recruiter_action(
	match_id: int,
	payload: RecruiterActionUpdate,
	session: Session = Depends(get_db),
	_current_user: User = Depends(require_roles("admin", "recruiter")),
) -> MatchRecord:
	record = session.get(MatchRecord, match_id)
	if record is None:
		raise HTTPException(status_code=404, detail="Match record not found")
	if payload.status not in RECRUITER_ACTION_STATUSES:
		raise HTTPException(status_code=422, detail="Unsupported recruiter action status")
	record.recruiter_action_status = payload.status
	session.commit()
	session.refresh(record)
	return record


@router.post("/run-drive/{drive_id}", response_model=MatchRunResponse)
def run_drive_matching(
	drive_id: int,
	session: Session = Depends(get_db),
) -> MatchRunResponse:
	"""Match students who meet a drive's recruiter-JD CGPA thresholds."""
	drive = session.get(PlacementDrive, drive_id)
	if drive is None:
		raise HTTPException(status_code=404, detail="Placement drive not found")
	if drive.status == "Completed":
		raise HTTPException(status_code=409, detail="Cannot run matching for a completed drive")

	recruiter_jds = list(
		session.scalars(
			select(RecruiterJD).where(
				func.lower(RecruiterJD.company_name) == drive.company_name.strip().lower()
			)
		)
	)
	if not recruiter_jds:
		raise HTTPException(status_code=404, detail="No recruiter job descriptions found for this drive")

	jd_ids = [jd.id for jd in recruiter_jds]
	existing_records = session.scalars(
		select(MatchRecord).where(MatchRecord.jd_id.in_(jd_ids))
	)
	records_by_key = {
		(record.student_id, record.jd_id): record for record in existing_records
	}
	students = list(session.scalars(select(Student).order_by(Student.id)))
	engine = AIPlacementEngine()
	matched_records: list[MatchRecord] = []
	eligible_student_ids: set[int] = set()
	created_count = 0
	updated_count = 0

	for student in students:
		for jd in recruiter_jds:
			if student.cgpa < jd.min_cgpa:
				continue
			eligible_student_ids.add(student.id)
			result = engine.match_and_explain(
				student.cgpa,
				student.skills,
				jd.min_cgpa,
				jd.required_skills,
			)
			fit_score = result["fit_score"]
			match_status = (
				"In-Progress" if fit_score >= SHORTLIST_FIT_THRESHOLD else "Pending"
			)
			record = records_by_key.get((student.id, jd.id))
			if record is None:
				record = MatchRecord(
					student_id=student.id,
					jd_id=jd.id,
					fit_score=fit_score,
					explanation=result["reason"],
					status=match_status,
				)
				session.add(record)
				created_count += 1
			else:
				record.fit_score = fit_score
				record.explanation = result["reason"]
				if record.status != "Placed":
					record.status = match_status
				updated_count += 1
			matched_records.append(record)

	session.flush()
	session.commit()

	shortlisted_count = sum(record.status == "In-Progress" for record in matched_records)
	return MatchRunResponse(
		drive_id=drive.id,
		company_name=drive.company_name,
		eligible_student_count=len(eligible_student_ids),
		created_records=created_count,
		updated_records=updated_count,
		shortlisted_count=shortlisted_count,
		matches=matched_records,
	)