import asyncio
import unittest
from unittest.mock import patch

from backend.app.api.v1.mock_interview import (
    SolutionEvaluationRequest,
    SpeechEvaluationRequest,
    evaluate_solution,
    evaluate_speech,
)


class MockInterviewTests(unittest.TestCase):
    def test_solution_analysis_returns_validated_ai_result(self) -> None:
        result_data = {
            "evaluated": True,
            "time_complexity": "O(n)",
            "space_complexity": "O(n)",
            "correctness": True,
            "code_quality_score": 88,
            "feedback": "Use a hash map to avoid repeated scans.",
            "edge_case_suggestions": ["Try duplicate values."],
        }
        payload = SolutionEvaluationRequest(
            problem_title="Two Sum",
            language="Python",
            code="def two_sum(nums, target): return []",
            category="Arrays",
        )

        with patch("backend.app.api.v1.mock_interview._generate_json", return_value=result_data):
            result = asyncio.run(evaluate_solution(payload, current_user=None))

        self.assertTrue(result.evaluated)
        self.assertEqual(result.code_quality_score, 88)
        self.assertEqual(result.edge_case_suggestions, ["Try duplicate values."])

    def test_solution_analysis_returns_explicit_fallback_on_provider_failure(self) -> None:
        payload = SolutionEvaluationRequest(
            problem_title="Two Sum",
            language="Python",
            code="pass",
            category="Arrays",
        )

        with patch(
            "backend.app.api.v1.mock_interview._generate_json",
            side_effect=RuntimeError("provider unavailable"),
        ):
            result = asyncio.run(evaluate_solution(payload, current_user=None))

        self.assertFalse(result.evaluated)
        self.assertEqual(result.code_quality_score, 0)
        self.assertIn("not evaluated", result.feedback)

    def test_speech_analysis_returns_explicit_fallback_on_provider_failure(self) -> None:
        payload = SpeechEvaluationRequest(topic="Two Sum", transcript="I would use a hash map.")

        with patch(
            "backend.app.api.v1.mock_interview._generate_json",
            side_effect=RuntimeError("provider unavailable"),
        ):
            result = asyncio.run(evaluate_speech(payload, current_user=None))

        self.assertFalse(result.evaluated)
        self.assertEqual(result.communication_clarity, 0)
        self.assertIn("not evaluated", result.feedback)


if __name__ == "__main__":
    unittest.main()
