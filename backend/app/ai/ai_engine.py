from collections.abc import Sequence
from typing import Any

from backend.app.ai.placement_engine import AIPlacementEngine as _PlacementEngine


class AIPlacementEngine(_PlacementEngine):
	"""Expose the placement scorer through the compact CampusLink business API."""

	def calculate_readiness(
		self,
		cgpa: float,
		skills: str | Sequence[str],
		mock_score: float,
	) -> tuple[float, str]:
		"""Return readiness using CGPA (30%), skills (30%), and mock score (40%)."""
		skill_values = skills if isinstance(skills, str) else list(skills)
		cgpa_value = self._bounded_number(cgpa, "cgpa", 0.0, self.MAX_CGPA)
		mock_value = self._bounded_number(mock_score, "mock_score", 0.0, 100.0)
		skill_count = len(self._normalize_skills(skill_values))
		skill_coverage = min(skill_count / self.MAX_SKILLS_FOR_READINESS, 1.0)
		score = round(
			(cgpa_value / self.MAX_CGPA) * 30
			+ skill_coverage * 30
			+ (mock_value / 100) * 40,
			2,
		)
		if score >= 85:
			status = "Highly Employable"
		elif score >= 70:
			status = "Ready"
		elif score >= 50:
			status = "Developing"
		else:
			status = "Not Ready"
		return score, status

	def match_and_explain(
		self,
		student_cgpa: float,
		student_skills: str | Sequence[str],
		jd_min_cgpa: float,
		required_skills: str | Sequence[str],
	) -> dict[str, Any]:
		"""Return a JD fit percentage, human explanation, and skill-gap detail."""
		student_skill_values = (
			student_skills if isinstance(student_skills, str) else list(student_skills)
		)
		required_skill_values = (
			required_skills if isinstance(required_skills, str) else list(required_skills)
		)
		cgpa_value = self._finite_number(student_cgpa, "student_cgpa", 0.0)
		minimum_cgpa = self._finite_number(jd_min_cgpa, "jd_min_cgpa", 0.0)
		required = self._normalize_skills(required_skill_values)
		student = self._normalize_skills(student_skill_values)
		matched_keys = required.keys() & student.keys()
		matched_skills = [required[key] for key in required if key in matched_keys]
		missing_skills = [required[key] for key in required if key not in matched_keys]

		if cgpa_value < minimum_cgpa:
			return {
				"fit_score": 0.0,
				"reason": (
					f"Below Threshold: CGPA {cgpa_value} is below the required minimum of "
					f"{minimum_cgpa}."
				),
				"matched_skills": matched_skills,
				"missing_skills": missing_skills,
			}

		skill_coverage = len(matched_keys) / len(required) if required else 1.0
		normalized_cgpa = min(max(cgpa_value, 0.0), self.MAX_CGPA) / self.MAX_CGPA
		fit_score = round(skill_coverage * 70 + normalized_cgpa * 30, 2)
		if missing_skills:
			reason = (
				"Developing Match: CGPA meets criteria, but missing required skills: "
				f"{', '.join(missing_skills)}."
			)
		elif matched_skills:
			reason = (
				"Strong Fit: CGPA meets the required cutoff and the required tech stack "
				f"({', '.join(matched_skills)}) is fully matched."
			)
		else:
			reason = "Strong Fit: CGPA meets the required cutoff; no JD skills were specified."

		return {
			"fit_score": fit_score,
			"reason": reason,
			"matched_skills": matched_skills,
			"missing_skills": missing_skills,
		}

	def generate_pitch(self, student_name: str, branch: str, cgpa: float, fit_score: float) -> str:
		"""Build a concise professional candidate pitch from verified profile fields."""
		if not isinstance(student_name, str) or not student_name.strip():
			raise ValueError("student_name must be a non-empty string")
		if not isinstance(branch, str) or not branch.strip():
			raise ValueError("branch must be a non-empty string")

		display_name = " ".join(student_name.split())
		display_branch = " ".join(branch.split())
		cgpa_value = self._bounded_number(cgpa, "cgpa", 0.0, self.MAX_CGPA)
		fit_value = self._bounded_number(fit_score, "fit_score", 0.0, 100.0)
		return (
			f"{display_name} is a {display_branch} engineering candidate with a "
			f"{cgpa_value:.2f}/10 CGPA and a {fit_value:.1f}% role-fit score. Their "
			"academic record and demonstrated alignment with the role make them a "
			"promising candidate for consideration."
		)