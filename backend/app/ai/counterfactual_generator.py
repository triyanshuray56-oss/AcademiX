from typing import Dict, Any

def calculate_delta(student_profile: Dict[str, Any], jd_requirements: Dict[str, Any], current_score: float) -> Dict[str, Any]:
    """
    Compares the student's metrics against JD embeddings to find the exact delta
    needed to reach the 75% shortlisting threshold.
    """
    threshold = 75.0
    if current_score >= threshold:
        return {"status": "Shortlisted", "delta_needed": 0}
    
    delta: Dict[str, Any] = {}
    
    req_cgpa = jd_requirements.get("min_cgpa", 0.0)
    student_cgpa = student_profile.get("cgpa", 0.0)
    
    if student_cgpa < req_cgpa:
        delta["cgpa_delta"] = round(req_cgpa - student_cgpa, 2)
        
    req_skills = set(jd_requirements.get("core_skills", []))
    student_skills = set(student_profile.get("skills", []))
    missing_skills = req_skills - student_skills
    
    if missing_skills:
        # Return one distinct missing skill for targeted action
        delta["skill_missing"] = list(missing_skills)[0] 
        
    return delta
