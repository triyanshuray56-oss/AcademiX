from pydantic import BaseModel
from typing import Optional
from enum import Enum

class DriveLiveStatus(str, Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    bottlenecked = "bottlenecked"
    completed = "completed"

class DriveBase(BaseModel):
    company_name: Optional[str] = None
    live_status: DriveLiveStatus = DriveLiveStatus.scheduled
    panel_throughput_rate: int = 20

class DriveCreate(DriveBase):
    pass

class Drive(DriveBase):
    id: int

    class Config:
        from_attributes = True
