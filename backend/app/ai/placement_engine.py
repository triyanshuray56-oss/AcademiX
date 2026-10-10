import math
import re
from typing import Any


TECH_SKILL_PATTERNS: dict[str, re.Pattern[str]] = {
    "Python": re.compile(r"(?<!\w)python(?:\s*3)?(?!\w)", re.IGNORECASE),
    "Java": re.compile(r"(?<!\w)java(?!\w)", re.IGNORECASE),
    "React": re.compile(r"(?<!\w)react(?:\.js|js)?(?!\w)", re.IGNORECASE),
    "AWS": re.compile(r"\bAWS\b|\bAmazon\s+Web\s+Services\b", re.IGNORECASE),
    "SQL": re.compile(r"\bSQL\b|\bStructured\s+Query\s+Language\b", re.IGNORECASE),
    "Machine Learning": re.compile(r"\bMachine[ -]Learning\b|\bML\b", re.IGNORECASE),
}

EXPERIENCE_PATTERNS = (
    re.compile(
        r"\b(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+"
        r"(?:professional\s+)?experience\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bexperience\s*(?:of|:|-)?\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b",
        re.IGNORECASE,
    ),
)

CERTIFICATION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "AWS Certified Solutions Architect",
        re.compile(r"\bAWS Certified Solutions Architect(?:\s*[-,]?\s*(?:Associate|Professional))?\b", re.IGNORECASE),
    ),
    (
        "AWS Certified Developer",
        re.compile(r"\bAWS Certified Developer(?:\s*[-,]?\s*Associate)?\b", re.IGNORECASE),
    ),
    (
        "AWS Certified Cloud Practitioner",
        re.compile(r"\bAWS Certified Cloud Practitioner\b", re.IGNORECASE),
    ),
    (
        "Microsoft Azure Fundamentals",
        re.compile(r"\bMicrosoft Certified:?\s*(?:Azure )?Fundamentals\b", re.IGNORECASE),
    ),
    (
        "Microsoft Azure Administrator Associate",
        re.compile(
            r"\bMicrosoft Certified:?\s*Azure Administrator Associate\b", re.IGNORECASE
        ),
    ),
    (
        "Google Cloud Certified",
        re.compile(r"\bGoogle Cloud Certified\b", re.IGNORECASE),
    ),
    (
        "Certified Kubernetes Administrator",
        re.compile(r"\bCertified Kubernetes Administrator(?:\s*\(CKA\))?\b", re.IGNORECASE),
    ),
    (
        "Oracle Certified Java Programmer",
        re.compile(r"\bOracle Certified (?:Professional )?Java Programmer\b", re.IGNORECASE),
    ),
    (
        "TensorFlow Developer Certificate",
        re.compile(r"\bTensorFlow Developer Certificate\b", re.IGNORECASE),
    ),
    (
        "CompTIA Security+",
        re.compile(r"\bCompTIA Security\+\b", re.IGNORECASE),
    ),
    (
        "Project Management Professional",
        re.compile(r"\bProject Management Professional(?:\s*\(PMP\))?\b", re.IGNORECASE),
    ),
)


class AIPlacementEngine:
    """Extract resume signals and score student readiness and job fit."""

    READINESS_WEIGHTS = {
        "cgpa": 0.30,
        "skills": 0.30,
        "interview": 0.20,
        "certifications_projects": 0.20,
    }
    MAX_CGPA = 10.0
    MAX_SKILLS_FOR_READINESS = 5
    MAX_EVIDENCE_ITEMS = 4
    FIT_WEIGHTS = {"skills": 0.65, "cgpa": 0.20, "interview": 0.15}

    def parse_resume_text(self, resume_text: str) -> dict[str, Any]:
        """Extract recognized skills, maximum stated experience, and known certifications.

        Matching is case-insensitive and limited to the built-in skills and certification
        vocabulary. Empty text returns empty collections and zero years. Non-string input
        is rejected rather than silently producing an empty profile.
        """
        if not isinstance(resume_text, str):
            raise TypeError("resume_text must be a string")

        skills = [
            skill
            for skill, pattern in TECH_SKILL_PATTERNS.items()
            if pattern.search(resume_text)
        ]
        years_of_experience = self._extract_years_of_experience(resume_text)
        certifications = [
            name
            for name, pattern in CERTIFICATION_PATTERNS
            if pattern.search(resume_text)
        ]
        if re.search(r"\bAWS Certified\b", resume_text, re.IGNORECASE) and not any(
            name.startswith("AWS Certified") for name in certifications
        ):
            certifications.append("AWS Certified")

        return {
            "skills": skills,
            "years_of_experience": years_of_experience,
            "certifications": certifications,
        }

    def calculate_readiness_score(self, student_data: dict[str, Any]) -> tuple[float, str]:
        """Return an employability score from 0 to 100 and its readiness category.

        CGPA is treated as a 10-point scale. Skill scoring uses required-skill coverage
        when ``required_skills`` is supplied, blended with skill breadth; otherwise it
        uses the number of recognized or listed skills. Certifications and projects
        contribute equally as evidence items, capped at four total.
        """
        self._require_dict(student_data, "student_data")

        cgpa = self._bounded_number(student_data.get("cgpa"), "cgpa", 0.0, self.MAX_CGPA)
        interview_value = self._first_value(
            student_data,
            ("mock_interview_score", "mock_interview_communication_score", "communication_score"),
            0.0,
        )
        interview_score = self._bounded_number(interview_value, "mock interview score", 0.0, 100.0)

        student_skills = self._normalize_skills(student_data.get("skills", []))
        required_skills = self._normalize_skills(student_data.get("required_skills", []))
        if required_skills:
            coverage = len(student_skills.keys() & required_skills.keys()) / len(required_skills)
            breadth = min(len(student_skills) / self.MAX_SKILLS_FOR_READINESS, 1.0)
            skills_score = 0.70 * coverage + 0.30 * breadth
        else:
            skills_score = min(len(student_skills) / self.MAX_SKILLS_FOR_READINESS, 1.0)

        evidence_count = min(
            self._count_evidence(student_data.get("certifications"), "certifications")
            + self._count_evidence(student_data.get("projects"), "projects"),
            self.MAX_EVIDENCE_ITEMS,
        )
        score = round(
            (cgpa / self.MAX_CGPA) * 100 * self.READINESS_WEIGHTS["cgpa"]
            + skills_score * 100 * self.READINESS_WEIGHTS["skills"]
            + (interview_score / 100) * 100 * self.READINESS_WEIGHTS["interview"]
            + (evidence_count / self.MAX_EVIDENCE_ITEMS)
            * 100
            * self.READINESS_WEIGHTS["certifications_projects"],
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

    def match_student_to_jd(self, student: dict[str, Any], jd: dict[str, Any]) -> dict[str, Any]:
        """Score a student's fit for a job description and explain the result.

        CGPA below the JD minimum is a hard eligibility failure with a zero fit score.
        Otherwise, fit combines required-skill coverage (65%), normalized CGPA (20%),
        and mock-interview score (15%).
        """
        self._require_dict(student, "student")
        self._require_dict(jd, "jd")

        cgpa = self._finite_number(student.get("cgpa"), "cgpa", 0.0)
        min_cgpa = self._finite_number(jd.get("min_cgpa"), "min_cgpa", 0.0)
        required_skills = self._normalize_skills(
            jd.get("required_skills", jd.get("skills", []))
        )
        student_skill_value = student.get("skills", student.get("resume_skills", []))
        parsed_resume = student.get("parsed_resume")
        if not student_skill_value and isinstance(parsed_resume, dict):
            student_skill_value = parsed_resume.get("skills", [])
        student_skills = self._normalize_skills(student_skill_value)

        matched_keys = required_skills.keys() & student_skills.keys()
        matched_skills = [
            required_skills[key] for key in required_skills if key in matched_keys
        ]
        missing_skills = [
            required_skills[key] for key in required_skills if key not in matched_keys
        ]

        if cgpa < min_cgpa:
            return {
                "fit_score": 0.0,
                "explanation": (
                    f"Below Threshold: CGPA {cgpa} is below the required minimum of {min_cgpa}."
                ),
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
            }

        skill_coverage = (
            len(matched_keys) / len(required_skills) if required_skills else 1.0
        )
        interview_value = self._first_value(
            student,
            ("mock_interview_score", "mock_interview_communication_score", "communication_score"),
            0.0,
        )
        interview_score = self._bounded_number(interview_value, "mock interview score", 0.0, 100.0)
        normalized_cgpa = min(max(cgpa, 0.0), self.MAX_CGPA) / self.MAX_CGPA
        fit_score = round(
            skill_coverage * self.FIT_WEIGHTS["skills"] * 100
            + normalized_cgpa * self.FIT_WEIGHTS["cgpa"] * 100
            + (interview_score / 100) * self.FIT_WEIGHTS["interview"] * 100,
            2,
        )

        if missing_skills:
            explanation = (
                "Developing Match: CGPA meets criteria, but missing required skills: "
                f"{', '.join(missing_skills)}."
            )
        elif fit_score >= 85 and interview_score >= 80:
            stack = ", ".join(matched_skills)
            if not stack:
                stack = ", ".join(list(student_skills.values())[:5]) or "available skills"
            explanation = (
                "Strong Fit: CGPA and required tech stack "
                f"({stack}) fully matched with high mock interview score."
            )
        else:
            explanation = (
                "Developing Match: CGPA meets criteria and required skills are matched, "
                f"but mock interview score ({interview_score}/100) is below the strong-fit benchmark."
            )

        return {
            "fit_score": fit_score,
            "explanation": explanation,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
        }

    def generate_recruiter_pitch(self, student: dict[str, Any], fit_score: float) -> str:
        """Build a factual, single-paragraph candidate summary for recruiter outreach."""
        self._require_dict(student, "student")
        candidate_name = " ".join(str(student.get("name", "The candidate")).split())
        branch = " ".join(str(student.get("branch", "engineering")).split())
        cgpa = self._bounded_number(student.get("cgpa"), "cgpa", 0.0, self.MAX_CGPA)
        fit = self._bounded_number(fit_score, "fit_score", 0.0, 100.0)
        interview_value = self._first_value(
            student,
            ("mock_interview_score", "mock_interview_communication_score", "communication_score"),
            0.0,
        )
        interview_score = self._bounded_number(interview_value, "mock interview score", 0.0, 100.0)

        skills = self._normalize_skills(student.get("skills", []))
        skill_summary = ", ".join(list(skills.values())[:5]) or "no listed technical skills"
        readiness_status = student.get("readiness_status")
        if not readiness_status:
            _, readiness_status = self.calculate_readiness_score(student)
        readiness_status = " ".join(str(readiness_status).split())

        certification_count = self._count_evidence(
            student.get("certifications"), "certifications"
        )
        project_count = self._count_evidence(student.get("projects"), "projects")
        return (
            f"We are pleased to recommend {candidate_name}, a {branch} student rated "
            f"{readiness_status}, with a {cgpa:.2f}/10 CGPA and a {fit:.1f}% fit score. "
            f"The candidate's relevant skills include {skill_summary}, and their mock "
            f"interview score is {interview_score:.0f}/100. Their profile lists "
            f"{certification_count} certification(s) and {project_count} project(s), "
            "providing concrete evidence of technical development."
        )

    @staticmethod
    def _require_dict(value: Any, field_name: str) -> None:
        if not isinstance(value, dict):
            raise TypeError(f"{field_name} must be a dictionary")

    @staticmethod
    def _first_value(data: dict[str, Any], keys: tuple[str, ...], default: Any) -> Any:
        return next((data[key] for key in keys if key in data), default)

    @staticmethod
    def _finite_number(value: Any, field_name: str, default: float) -> float:
        if value is None:
            return default
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError) as error:
            raise ValueError(f"{field_name} must be a finite number") from error
        if not math.isfinite(number):
            raise ValueError(f"{field_name} must be a finite number")
        return number

    def _bounded_number(
        self,
        value: Any,
        field_name: str,
        minimum: float,
        maximum: float,
    ) -> float:
        number = self._finite_number(value, field_name, minimum)
        return min(max(number, minimum), maximum)

    @staticmethod
    def _skill_entries(value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            entries = re.split(r"[,;|\n]", value)
        elif isinstance(value, (list, tuple, set, frozenset)):
            entries = [str(item) for item in value]
        else:
            raise TypeError("skills and required_skills must be text or a collection of strings")
        return [entry.strip() for entry in entries if entry.strip()]

    @classmethod
    def _normalize_skills(cls, value: Any) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for entry in cls._skill_entries(value):
            recognized = [
                name for name, pattern in TECH_SKILL_PATTERNS.items() if pattern.search(entry)
            ]
            if recognized:
                normalized.update((name.casefold(), name) for name in recognized)
                continue

            key = re.sub(r"[^a-z0-9+#]+", " ", entry.casefold()).strip()
            if key:
                normalized.setdefault(key, entry)
        return normalized

    @classmethod
    def _extract_years_of_experience(cls, resume_text: str) -> float:
        matches = [
            float(match.group(1))
            for pattern in EXPERIENCE_PATTERNS
            for match in pattern.finditer(resume_text)
        ]
        return max(matches, default=0.0)

    @staticmethod
    def _count_evidence(value: Any, field_name: str) -> int:
        if value is None:
            return 0
        if isinstance(value, str):
            return sum(bool(item.strip()) for item in re.split(r"[,;\n]", value))
        if isinstance(value, dict):
            return int(bool(value))
        if isinstance(value, (list, tuple, set, frozenset)):
            return sum(item is not None and bool(str(item).strip()) for item in value)
        raise TypeError(f"{field_name} must be text or a collection")