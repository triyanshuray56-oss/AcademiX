import unittest

from backend.app.ai.ai_engine import AIPlacementEngine


class AIEngineApiTests(unittest.TestCase):
	def setUp(self) -> None:
		self.engine = AIPlacementEngine()

	def test_readiness_uses_available_inputs_across_full_scale(self) -> None:
		self.assertEqual(
			self.engine.calculate_readiness(
				10,
				["Python", "Java", "React", "AWS", "SQL"],
				100,
			),
			(100.0, "Highly Employable"),
		)

	def test_match_and_explain_applies_cgpa_gate_and_reports_skill_gaps(self) -> None:
		below_threshold = self.engine.match_and_explain(5.5, ["Python"], 6.0, ["Python"])
		self.assertEqual(below_threshold["fit_score"], 0.0)
		self.assertIn("Below Threshold:", below_threshold["reason"])

		partial = self.engine.match_and_explain(
			8.0,
			["Python"],
			6.0,
			["Python", "React"],
		)
		self.assertEqual(partial["missing_skills"], ["React"])
		self.assertIn("missing required skills: React", partial["reason"])

	def test_match_and_explain_reports_strong_fit_without_mock_score_input(self) -> None:
		result = self.engine.match_and_explain(
			9.0,
			["Python", "React"],
			8.0,
			["Python", "React"],
		)

		self.assertGreaterEqual(result["fit_score"], 85.0)
		self.assertIn("Strong Fit:", result["reason"])

	def test_generate_pitch_returns_one_professional_paragraph(self) -> None:
		pitch = self.engine.generate_pitch("Asha Rao", "CSE", 8.5, 91.2)
		self.assertNotIn("\n", pitch)
		self.assertIn("Asha Rao", pitch)
		self.assertIn("91.2%", pitch)


if __name__ == "__main__":
	unittest.main()