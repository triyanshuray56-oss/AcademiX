import unittest

from backend.app.ai.placement_engine import AIPlacementEngine


class AIPlacementEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = AIPlacementEngine()

    def test_parse_resume_extracts_skills_experience_and_certifications(self) -> None:
        result = self.engine.parse_resume_text(
            "Python, Java, React.js, AWS, SQL, Machine Learning. "
            "3+ years of experience. AWS Certified Solutions Architect and "
            "Certified Kubernetes Administrator."
        )

        self.assertEqual(
            result["skills"],
            ["Python", "Java", "React", "AWS", "SQL", "Machine Learning"],
        )
        self.assertEqual(result["years_of_experience"], 3.0)
        self.assertEqual(
            result["certifications"],
            ["AWS Certified Solutions Architect", "Certified Kubernetes Administrator"],
        )

    def test_readiness_status_uses_requested_thresholds(self) -> None:
        cases = (
            ({}, (0.0, "Not Ready")),
            (
                {"cgpa": 10, "skills": ["Python"], "mock_interview_score": 70},
                (50.0, "Developing"),
            ),
            (
                {
                    "cgpa": 10,
                    "skills": ["Python", "Java"],
                    "mock_interview_score": 90,
                    "certifications": ["AWS"],
                    "projects": ["Placement portal"],
                },
                (70.0, "Ready"),
            ),
            (
                {
                    "cgpa": 10,
                    "skills": ["Python", "Java", "React", "AWS", "SQL"],
                    "mock_interview_score": 75,
                    "certifications": ["AWS", "Azure"],
                },
                (85.0, "Highly Employable"),
            ),
        )

        for student, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(self.engine.calculate_readiness_score(student), expected)

    def test_readiness_uses_required_skill_coverage(self) -> None:
        score, status = self.engine.calculate_readiness_score(
            {
                "cgpa": 8,
                "skills": "Python",
                "required_skills": "Python, React",
                "mock_interview_score": 80,
            }
        )

        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 100.0)
        self.assertIn(status, {"Not Ready", "Developing", "Ready", "Highly Employable"})

    def test_matching_rejects_candidate_below_cgpa_threshold(self) -> None:
        result = self.engine.match_student_to_jd(
            {"cgpa": 5.5, "skills": "Python"},
            {"min_cgpa": 6.0, "required_skills": "Python, React"},
        )

        self.assertEqual(result["fit_score"], 0.0)
        self.assertEqual(
            result["explanation"],
            "Below Threshold: CGPA 5.5 is below the required minimum of 6.0.",
        )

    def test_matching_explains_missing_skills(self) -> None:
        result = self.engine.match_student_to_jd(
            {"cgpa": 8.0, "skills": "Python", "mock_interview_score": 60},
            {"min_cgpa": 6.0, "required_skills": "Python, React"},
        )

        self.assertEqual(result["missing_skills"], ["React"])
        self.assertEqual(
            result["explanation"],
            "Developing Match: CGPA meets criteria, but missing required skills: React.",
        )
        self.assertGreaterEqual(result["fit_score"], 0.0)
        self.assertLessEqual(result["fit_score"], 100.0)

    def test_matching_explains_strong_fit(self) -> None:
        result = self.engine.match_student_to_jd(
            {"cgpa": 9.0, "skills": "Python, React", "mock_interview_score": 90},
            {"min_cgpa": 8.0, "required_skills": "Python, React"},
        )

        self.assertEqual(result["fit_score"], 96.5)
        self.assertEqual(
            result["explanation"],
            "Strong Fit: CGPA and required tech stack (Python, React) fully matched "
            "with high mock interview score.",
        )

    def test_recruiter_pitch_is_a_single_paragraph(self) -> None:
        pitch = self.engine.generate_recruiter_pitch(
            {
                "name": "Ananya Mohanty",
                "branch": "CSE",
                "cgpa": 9.1,
                "skills": "Python, SQL, React",
                "mock_interview_score": 86,
                "certifications": ["AWS Certified"],
                "projects": ["Placement portal"],
            },
            92.5,
        )

        self.assertNotIn("\n", pitch)
        self.assertIn("Ananya Mohanty", pitch)
        self.assertIn("92.5% fit score", pitch)
        self.assertIn("Python, SQL, React", pitch)

    def test_invalid_numeric_input_is_reported(self) -> None:
        with self.assertRaisesRegex(ValueError, "cgpa must be a finite number"):
            self.engine.calculate_readiness_score({"cgpa": "not-a-number"})


if __name__ == "__main__":
    unittest.main()