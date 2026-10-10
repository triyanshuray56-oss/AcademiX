from typing import List, Dict, Any

class PanelLoadBalancer:
    @staticmethod
    def redistribute_queue(drive_id: int, active_panels_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detects if a panel is >15 minutes behind schedule and reassigns 
        queued students to idle panels using a simple round-robin logic.
        """
        idle_panels = [p for p in active_panels_data if p.get("status") == "idle"]
        if not idle_panels:
            return active_panels_data
            
        idle_idx = 0
        
        for panel in active_panels_data:
            delay_mins = panel.get("delay_minutes", 0)
            if delay_mins > 15 and panel.get("queue", []):
                student_to_move = panel["queue"].pop()
                target_panel = idle_panels[idle_idx % len(idle_panels)]
                
                if "queue" not in target_panel:
                    target_panel["queue"] = []
                target_panel["queue"].append(student_to_move)
                
                idle_idx += 1
                
        return active_panels_data
