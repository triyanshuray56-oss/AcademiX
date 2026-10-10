import unittest
from datetime import datetime

from backend.app.services.conflict_engine import ConflictEngine


class ConflictEngineTests(unittest.TestCase):
	def setUp(self) -> None:
		self.engine = ConflictEngine()

	def test_detects_date_time_venue_and_student_conflicts(self) -> None:
		drives = [
			{
				"id": 1,
				"company_name": "TCS",
				"drive_date": datetime(2026, 10, 15, 10),
				"venue": "Main Auditorium",
				"status": "Scheduled",
				"shortlisted_student_ids": [12],
			},
			{
				"id": 2,
				"company_name": "Infosys",
				"drive_date": datetime(2026, 10, 15, 10),
				"venue": " main auditorium ",
				"status": "Conflicted",
				"shortlisted_student_ids": [12, 13],
			},
		]

		conflicts = self.engine.check_drive_conflicts(drives)

		self.assertEqual(len(conflicts), 1)
		self.assertEqual(
			set(conflicts[0]["conflict_types"]),
			{"same_date", "same_datetime", "same_venue", "student_overlap"},
		)
		self.assertEqual(conflicts[0]["student_ids"], [12])
		self.assertTrue(conflicts[0]["suggestions"])
		self.assertIn("different venue", conflicts[0]["suggestions"][0])

	def test_same_venue_on_different_dates_suggests_a_change(self) -> None:
		conflicts = self.engine.check_drive_conflicts(
			[
				{
					"id": 1,
					"company_name": "TCS",
					"drive_date": datetime(2026, 10, 15, 10),
					"venue": "Main Auditorium",
				},
				{
					"id": 2,
					"company_name": "Wipro",
					"drive_date": datetime(2026, 10, 16, 10),
					"venue": "Main Auditorium",
				},
			]
		)

		self.assertEqual(conflicts[0]["conflict_types"], ["same_venue"])
		self.assertIn("different venue", conflicts[0]["suggestions"][0])

	def test_completed_drives_are_ignored(self) -> None:
		conflicts = self.engine.check_drive_conflicts(
			[
				{
					"id": 1,
					"company_name": "TCS",
					"drive_date": datetime(2026, 10, 15, 10),
					"venue": "Main Auditorium",
					"status": "Completed",
				},
				{
					"id": 2,
					"company_name": "Infosys",
					"drive_date": datetime(2026, 10, 15, 10),
					"venue": "Main Auditorium",
					"status": "Scheduled",
				},
			]
		)

		self.assertEqual(conflicts, [])

	def test_invalid_active_drive_data_raises_a_clear_error(self) -> None:
		with self.assertRaisesRegex(ValueError, "positive integer"):
			self.engine.check_drive_conflicts(
				[{"id": 0, "company_name": "TCS", "drive_date": "2026-10-15", "venue": "Hall"}]
			)


if __name__ == "__main__":
	unittest.main()