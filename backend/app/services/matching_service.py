from typing import List, Dict, Any

def gale_shapley_match(students: List[Dict[str, Any]], drives: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Implements a lightweight Gale-Shapley matching algorithm for Pareto-optimal placement.
    Prevents the top 5% of students from holding all concurrent offers.
    """
    free_students = [s['id'] for s in students]
    student_prefs = {s['id']: s.get('preferences', []).copy() for s in students}
    drive_prefs = {d['id']: d.get('preferences', []) for d in drives}
    drive_capacities = {d['id']: d.get('capacity', 1) for d in drives}
    
    drive_matches: Dict[str, List[str]] = {d['id']: [] for d in drives}
    
    while free_students:
        s = free_students.pop(0)
        prefs = student_prefs.get(s, [])
        
        if not prefs:
            continue
            
        d = prefs.pop(0)
        
        if len(drive_matches[d]) < drive_capacities[d]:
            drive_matches[d].append(s)
        else:
            current_matches = drive_matches[d]
            d_pref_list = drive_prefs.get(d, [])
            
            def get_rank(student_id):
                return d_pref_list.index(student_id) if student_id in d_pref_list else float('inf')
            
            current_matches.sort(key=get_rank)
            worst_match = current_matches[-1]
            
            if get_rank(s) < get_rank(worst_match):
                drive_matches[d].remove(worst_match)
                drive_matches[d].append(s)
                free_students.append(worst_match)
            else:
                free_students.append(s)
                
    final_matches = {}
    for d, matched_students in drive_matches.items():
        for s in matched_students:
            final_matches[s] = d
            
    return final_matches
