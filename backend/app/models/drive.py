import enum
from sqlalchemy import Column, Integer, String, Enum
from backend.app.database import Base

class DriveLiveStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    bottlenecked = "bottlenecked"
    completed = "completed"

class Drive(Base):
    __tablename__ = "drives"
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=True)
    live_status = Column(Enum(DriveLiveStatus), default=DriveLiveStatus.scheduled)
    panel_throughput_rate = Column(Integer, default=20)
