from typing import Dict, Any

def generate_candidate_pitch(student_profile: Dict[str, Any], jd: Dict[str, Any]) -> str:
    """
    Takes a shortlisted student's profile and the specific JD, 
    outputting a 3-sentence personalized pitch explaining why they are a perfect fit.
    """
    name = student_profile.get("name", "The candidate")
    strongest_skill = student_profile.get("top_skill", "problem solving")
    role = jd.get("title", "this role")
    
    pitch = (
        f"{name} is an exceptional fit for {role} due to their proven expertise in {strongest_skill}. "
        f"They possess a strong combination of the core technical competencies and soft skills required by your job description. "
        f"Their recent project work directly aligns with your team's objectives, ensuring they can contribute from day one."
    )
    return pitch
