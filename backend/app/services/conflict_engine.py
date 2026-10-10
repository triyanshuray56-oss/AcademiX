from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any


@dataclass(frozen=True)
class _DriveSlot:
	drive_id: int
	company_name: str
	drive_date: datetime
	venue: str
	shortlisted_student_ids: frozenset[int]


class ConflictEngine:
	"""Detect active drive schedule clashes and suggest safer replacement slots."""

	ACTIVE_STATUSES = frozenset({"scheduled", "conflicted"})
	MAX_RESCHEDULE_DAYS = 365

	def check_drive_conflicts(self, drives: Iterable[Any]) -> list[dict[str, Any]]:
		"""Find same-date/time, venue, and shortlisted-student conflicts.

		Each drive may be an ORM/Pydantic object or a mapping. Mapping inputs can include
		``shortlisted_student_ids`` to detect a student assigned to competing drives.
		Completed drives are ignored. Each returned conflict includes concrete
		rescheduling suggestions based on dates not occupied by the supplied active drives.
		"""
		if isinstance(drives, (str, bytes, Mapping)):
			raise TypeError("drives must be an iterable of drive records")

		active_drives = [
			drive
			for drive in (self._coerce_drive(item) for item in drives)
			if drive is not None
		]
		conflicts: list[dict[str, Any]] = []
		occupied_dates = {drive.drive_date.date() for drive in active_drives}

		for index, first in enumerate(active_drives):
			for second in active_drives[index + 1 :]:
				same_date = first.drive_date.date() == second.drive_date.date()
				same_datetime = first.drive_date == second.drive_date
				same_venue = first.venue.casefold() == second.venue.casefold()
				shared_students = sorted(
					first.shortlisted_student_ids & second.shortlisted_student_ids
				)
				if not (same_date or same_venue or shared_students and same_datetime):
					continue

				conflict_types: list[str] = []
				if same_date:
					conflict_types.append("same_date")
				if same_datetime:
					conflict_types.append("same_datetime")
				if same_venue:
					conflict_types.append("same_venue")
				if shared_students and same_date:
					conflict_types.append("student_overlap")

				conflicts.append(
					{
						"drive_ids": [first.drive_id, second.drive_id],
						"conflict_types": conflict_types,
						"student_ids": shared_students if same_date else [],
						"suggestions": self._suggest_reschedules(
							first,
							second,
							occupied_dates,
							same_venue=same_venue,
							shared_students=shared_students if same_date else [],
						),
					}
				)
		return conflicts

	@classmethod
	def _coerce_drive(cls, value: Any) -> _DriveSlot | None:
		status = cls._field(value, "status", "Scheduled")
		if not isinstance(status, str):
			raise TypeError("drive status must be a string")
		if status.casefold() not in cls.ACTIVE_STATUSES:
			return None

		drive_id = cls._field(value, "id", None)
		company_name = cls._field(value, "company_name", None)
		drive_date = cls._field(value, "drive_date", None)
		venue = cls._field(value, "venue", None)
		if not isinstance(drive_id, int) or isinstance(drive_id, bool) or drive_id <= 0:
			raise ValueError("active drive id must be a positive integer")
		if not isinstance(company_name, str) or not company_name.strip():
			raise ValueError(f"drive {drive_id} must have a company_name")
		if isinstance(drive_date, date) and not isinstance(drive_date, datetime):
			drive_date = datetime.combine(drive_date, time.min)
		elif isinstance(drive_date, str):
			try:
				drive_date = datetime.fromisoformat(drive_date)
			except ValueError as error:
				raise ValueError(f"drive {drive_id} has an invalid drive_date") from error
		if not isinstance(drive_date, datetime):
			raise ValueError(f"drive {drive_id} must have a valid drive_date")
		if not isinstance(venue, str) or not venue.strip():
			raise ValueError(f"drive {drive_id} must have a venue")

		student_ids = cls._field(value, "shortlisted_student_ids", ()) or ()
		if isinstance(student_ids, (str, bytes, Mapping)):
			raise TypeError("shortlisted_student_ids must be an iterable of positive integers")
		try:
			student_id_set = frozenset(student_ids)
		except TypeError as error:
			raise TypeError(
				"shortlisted_student_ids must be an iterable of positive integers"
			) from error
		if any(
			not isinstance(student_id, int)
			or isinstance(student_id, bool)
			or student_id <= 0
			for student_id in student_id_set
		):
			raise ValueError("shortlisted student IDs must be positive integers")

		return _DriveSlot(
			drive_id=drive_id,
			company_name=company_name.strip(),
			drive_date=drive_date,
			venue=venue.strip(),
			shortlisted_student_ids=student_id_set,
		)

	@staticmethod
	def _field(value: Any, name: str, default: Any) -> Any:
		if isinstance(value, Mapping):
			return value.get(name, default)
		return getattr(value, name, default)

	@classmethod
	def _suggest_reschedules(
		cls,
		first: _DriveSlot,
		second: _DriveSlot,
		occupied_dates: set[date],
		*,
		same_venue: bool,
		shared_students: list[int],
	) -> list[str]:
		moving_drive = max((first, second), key=lambda drive: (drive.drive_date, drive.drive_id))
		candidate = cls._next_available_datetime(moving_drive.drive_date, occupied_dates)
		venue_advice = (
			"at a different venue with no active booking"
			if same_venue
			else "at its current venue"
		)
		other_drive_id = first.drive_id if moving_drive.drive_id == second.drive_id else second.drive_id
		suggestions = [
			f"Move drive {moving_drive.drive_id} to {candidate.isoformat(timespec='minutes')} "
			f"{venue_advice} to avoid the conflict with drive {other_drive_id}."
		]
		if shared_students:
			ids = ", ".join(str(student_id) for student_id in shared_students)
			suggestions.append(
				f"Confirm shortlisted student(s) {ids} before finalizing the replacement slot."
			)
		return suggestions

	@classmethod
	def _next_available_datetime(
		cls,
		start: datetime,
		occupied_dates: set[date],
	) -> datetime:
		for days_ahead in range(1, cls.MAX_RESCHEDULE_DAYS + 1):
			candidate = start + timedelta(days=days_ahead)
			if candidate.date() not in occupied_dates:
				return candidate
		raise RuntimeError("No unoccupied drive date found within the rescheduling horizon")