import asyncio
import json
import logging
import unittest
from unittest.mock import patch

from backend.app.api.v1.tests import (
    AdaptiveTestRequest,
    _fallback_questions,
    _generate_with_ai,
    _validate_questions,
    generate_adaptive_test,
)


class AdaptiveTestsTests(unittest.TestCase):
    def test_fallback_returns_requested_count_with_expected_question_shape(self) -> None:
        questions = _fallback_questions(3)

        self.assertEqual(len(questions), 3)
        self.assertEqual([question["id"] for question in questions], [1, 2, 3])
        for question in questions:
            self.assertEqual(set(question), {"id", "question", "options", "correct_answer", "explanation"})
            self.assertEqual(len(question["options"]), 4)
            self.assertIn(question["correct_answer"], range(4))

    def test_ai_questions_are_validated_and_ids_are_normalized(self) -> None:
        candidate = {
            "questions": [{
                "id": 42,
                "question": "What is 1 + 1?",
                "options": ["0", "1", "2", "3"],
                "correct_answer": 2,
                "explanation": "Adding one and one gives two.",
            }]
        }

        validated = _validate_questions(json.dumps(candidate), 1)

        self.assertEqual(validated[0]["id"], 1)
        self.assertEqual(validated[0]["correct_answer"], 2)

    def test_validator_normalizes_common_llm_field_and_option_variations(self) -> None:
        candidate = {
            "questions": [
                {
                    "question_text": "Which is a stack?",
                    "options": {"A": "Queue", "B": "Stack", "C": "Tree", "D": "Graph"},
                    "correct_option": "B",
                    "explanation": "A stack uses last-in, first-out order.",
                    "difficulty": "medium",
                },
                {
                    "prompt": "Which is a queue?",
                    "options": ["Stack", "Queue", "Tree", "Graph"],
                    "answer": "Queue",
                    "explanation": "A queue uses first-in, first-out order.",
                },
            ]
        }

        validated = _validate_questions(candidate, 2)

        self.assertEqual(validated[0]["question"], "Which is a stack?")
        self.assertEqual(validated[0]["options"], ["Queue", "Stack", "Tree", "Graph"])
        self.assertEqual(validated[0]["correct_answer"], 1)
        self.assertEqual(validated[1]["correct_answer"], 1)
        self.assertEqual(set(validated[0]), {"id", "question", "options", "correct_answer", "explanation"})

    def test_validator_normalizes_delimited_options_and_one_based_correct_option(self) -> None:
        candidate = {
            "questions": [{
                "question": "Which is the fourth option?",
                "options": "A. First\nB. Second\nC. Third\nD. Fourth",
                "correct_option": 4,
                "explanation": "The fourth option is correct.",
            }]
        }

        validated = _validate_questions(candidate, 1)

        self.assertEqual(validated[0]["options"], ["A. First", "B. Second", "C. Third", "D. Fourth"])
        self.assertEqual(validated[0]["correct_answer"], 3)

    def test_generation_logs_raw_response_when_validation_fails(self) -> None:
        raw_response = '{"questions":[{"question":"Broken","options":[],"answer":0}]}'
        with (
            patch("backend.app.api.v1.tests.create_chat_completion", return_value=raw_response) as completion,
            self.assertLogs("backend.app.api.v1.tests", level=logging.ERROR) as captured,
        ):
            with self.assertRaisesRegex(ValueError, "invalid fields"):
                _generate_with_ai("Core CS", "Medium", 1)

        self.assertIn(raw_response, captured.output[0])
        self.assertEqual(completion.call_args.kwargs["json_mode"], True)
        prompt = completion.call_args.args[0][1]["content"]
        self.assertIn('"correct_answer": 1', prompt)
        self.assertIn('"options": ["Queue", "Stack", "Tree", "Graph"]', prompt)

    def test_missing_api_key_returns_local_questions(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            questions = asyncio.run(
                generate_adaptive_test(AdaptiveTestRequest(topic="Core CS", difficulty="Medium"))
            )

        self.assertEqual(len(questions), 3)

    def test_provider_failure_returns_local_questions(self) -> None:
        with (
            patch.dict("os.environ", {"GROQ_API_KEY": "test-key"}),
            patch("backend.app.api.v1.tests._generate_with_ai", side_effect=RuntimeError("provider unavailable")),
        ):
            questions = asyncio.run(
                generate_adaptive_test(AdaptiveTestRequest(topic="Core CS", difficulty="Medium"))
            )

        self.assertEqual(len(questions), 3)


if __name__ == "__main__":
    unittest.main()
