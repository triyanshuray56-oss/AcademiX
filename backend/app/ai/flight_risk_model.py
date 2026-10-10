def calculate_renege_probability(student_id: int, pending_apps: int = 0, current_offers: int = 0, historical_rate: float = 0.05) -> float:
    """
    Computes flight risk based on active pending applications, current accepted offers, 
    and historical branch conversion rates.
    """
    risk = historical_rate
    
    if current_offers > 0:
        risk += 0.3  # Baseline jump due to having a safety net
        risk += (pending_apps * 0.05) # Each pending app increases risk of reneging
        
    return min(risk, 0.99)
