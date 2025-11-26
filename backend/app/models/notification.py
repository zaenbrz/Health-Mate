from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class NotificationType(str, Enum):
    APPOINTMENT_BOOKED = "appointment_booked"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    NEW_APPOINTMENT_FOR_DOCTOR = "new_appointment_for_doctor"
    HEALTH_REMINDER = "health_reminder"
    APPOINTMENT_REMINDER = "appointment_reminder"

class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class Notification(BaseModel):
    id: Optional[str] = None
    user_email: str
    type: NotificationType
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.MEDIUM
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    created_at: Optional[datetime] = None
    
    class Config:
        use_enum_values = True

class NotificationResponse(Notification):
    id: str
    created_at: datetime
    
    @staticmethod
    def from_dict(data: dict) -> 'NotificationResponse':
        return NotificationResponse(
            id=str(data["_id"]),
            user_email=data["user_email"],
            type=data["type"],
            title=data["title"],
            message=data["message"],
            priority=data.get("priority", "medium"),
            data=data.get("data"),
            read=data.get("read", False),
            created_at=data.get("created_at", datetime.utcnow())
        )

class HealthReminder(BaseModel):
    """Health reminder based on AI recommendations from medical reports"""
    user_email: str
    reminder_text: str
    source: str  # e.g., "AI Report - Brain Tumor Analysis"
    frequency: str = "daily"  # daily, weekly, monthly
    active: bool = True
    last_sent: Optional[datetime] = None
