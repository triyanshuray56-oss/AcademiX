from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import MatchRecord, PlacementDrive, RecruiterJD, Student
from backend.app.schemas.api import DashboardAnalytics

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
ACTIVE_DRIVE_STATUSES = ("Scheduled", "Conflicted")


@router.get("/analytics", response_model=DashboardAnalytics)
def get_dashboard_analytics(session: Session = Depends(get_db)) -> DashboardAnalytics:
	"""Aggregate placement readiness, active drives, offers, and branch conversion."""
	total_students = session.scalar(select(func.count(Student.id)) ) or 0
	placement_ready_count = (
		session.scalar(
			select(func.count(Student.id)).where(Student.readiness_score >= 70.0)
		)
		or 0
	)
	active_drives_count = (
		session.scalar(
			select(func.count(PlacementDrive.id)).where(
				PlacementDrive.status.in_(ACTIVE_DRIVE_STATUSES)
			)
		)
		or 0
	)
	offers_accepted = (
		session.scalar(
			select(func.count(MatchRecord.id)).where(MatchRecord.status == "Placed")
		)
		or 0
	)

	branch_totals = dict(
		session.execute(
			select(func.upper(Student.branch), func.count(Student.id)).group_by(
				func.upper(Student.branch)
			)
		).all()
	)
	branch_placements = dict(
		session.execute(
			select(
				func.upper(Student.branch),
				func.count(distinct(MatchRecord.student_id)),
			)
			.join(MatchRecord, MatchRecord.student_id == Student.id)
			.where(MatchRecord.status == "Placed")
			.group_by(func.upper(Student.branch))
		).all()
	)
	package_trends = {
		company_name: round(float(average_package or 0.0), 2)
		for company_name, average_package in session.execute(
			select(RecruiterJD.company_name, func.avg(RecruiterJD.package_lpa))
			.group_by(RecruiterJD.company_name)
			.order_by(RecruiterJD.company_name)
		).all()
	}
	conversion_percentages = {
		branch: round(
			branch_placements.get(branch, 0) / branch_totals.get(branch, 0) * 100, 2
		)
		if branch_totals.get(branch)
		else 0.0
		for branch in branch_totals
	}

	placed_student_ids = select(MatchRecord.student_id).where(
		MatchRecord.status == "Placed"
	)
	at_risk_unplaced_count = (
		session.scalar(
			select(func.count(Student.id)).where(
				Student.readiness_score < 50.0,
				~Student.id.in_(placed_student_ids),
			)
		)
		or 0
	)

	return DashboardAnalytics(
		total_students=total_students,
		placement_ready_count=placement_ready_count,
		active_drives_count=active_drives_count,
		offers_accepted=offers_accepted,
		branch_conversion_percentages=conversion_percentages,
		package_trends=package_trends,
		at_risk_unplaced_count=at_risk_unplaced_count,
	)
