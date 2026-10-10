from typing import Dict, Any

def generate_gamified_nudge(skill_gap: str) -> Dict[str, Any]:
    """
    Takes a detected skill gap and returns a bite-sized action item.
    """
    catalog = {
        "AWS": "Complete this 2-hour AWS free tier lab to boost your readiness score by 4 points.",
        "Python": "Solve 3 medium Python challenges on LeetCode to boost your coding metric.",
        "React": "Build a quick React to-do list component to fill this gap and earn the Frontend Badge.",
        "System Design": "Watch a 30-minute system design primer video to improve your interview readiness."
    }
    
    action_item = catalog.get(skill_gap, f"Complete a quick tutorial on {skill_gap} to boost your readiness score.")
    
    return {
        "skill": skill_gap,
        "nudge": action_item,
        "points_potential": 4
    }
