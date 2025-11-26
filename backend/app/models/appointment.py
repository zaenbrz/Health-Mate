from typing import List, Dict, Optional
from datetime import datetime, date, time
from pydantic import BaseModel, EmailStr
from enum import Enum
import uuid
import logging

logger = logging.getLogger(__name__)

class AppointmentStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"
    
    @classmethod
    def from_string(cls, status_str: str):
        """Convert string status to enum, handling case variations"""
        status_mapping = {
            'scheduled': cls.SCHEDULED,
            'SCHEDULED': cls.SCHEDULED,
            'confirmed': cls.CONFIRMED,
            'CONFIRMED': cls.CONFIRMED,
            'cancelled': cls.CANCELLED,
            'CANCELLED': cls.CANCELLED,
            'completed': cls.COMPLETED,
            'COMPLETED': cls.COMPLETED,
            'no_show': cls.NO_SHOW,
            'NO_SHOW': cls.NO_SHOW,
        }
        return status_mapping.get(status_str, cls.SCHEDULED)

class AppointmentBase(BaseModel):
    patient_email: EmailStr
    doctor_email: EmailStr
    appointment_date: date
    appointment_time: time
    duration_minutes: int = 30
    appointment_type: str = "consultation"
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    appointment_date: Optional[date] = None
    appointment_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    appointment_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[AppointmentStatus] = None
    completion_notes: Optional[str] = None

class AppointmentResponse(AppointmentBase):
    id: str
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    completion_notes: Optional[str] = None

class AppointmentSlot(BaseModel):
    date: date
    time: time
    doctor_email: EmailStr
    doctor_name: str
    specialization: str
    is_available: bool
    duration_minutes: int = 30

class AppointmentReminder(BaseModel):
    appointment_id: str
    patient_email: EmailStr
    doctor_email: EmailStr
    appointment_date: date
    appointment_time: time
    reminder_sent: bool = False
    sent_at: Optional[datetime] = None


class AppointmentModel:
    """Pure data model for appointments - no business logic"""
    
    @staticmethod
    def to_dict(appointment_data: AppointmentCreate) -> Dict:
        """Convert appointment data to dictionary for MongoDB storage"""
        appointment_time = appointment_data.appointment_time
        appointment_time_str = appointment_time.isoformat() if hasattr(appointment_time, 'isoformat') else str(appointment_time)
        
        return {
            "id": str(uuid.uuid4()),
            "patient_email": appointment_data.patient_email,
            "doctor_email": appointment_data.doctor_email,
            "appointment_date": appointment_data.appointment_date.isoformat(),
            "appointment_time": appointment_time_str,
            "duration_minutes": appointment_data.duration_minutes,
            "appointment_type": appointment_data.appointment_type,
            "notes": appointment_data.notes,
            "status": AppointmentStatus.SCHEDULED,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

    @staticmethod
    def from_dict(data: Dict) -> Optional[AppointmentResponse]:
        """Convert MongoDB document to AppointmentResponse"""
        try:
            # Handle status conversion
            status_str = data.get("status", "SCHEDULED")
            status = AppointmentStatus.from_string(status_str)
            
            return AppointmentResponse(
                id=data.get("id"),
                patient_email=data.get("patient_email"),
                doctor_email=data.get("doctor_email"),
                appointment_date=data.get("appointment_date"),
                appointment_time=data.get("appointment_time"),
                duration_minutes=data.get("duration_minutes"),
                appointment_type=data.get("appointment_type"),
                notes=data.get("notes"),
                status=status,
                created_at=data.get("created_at"),
                updated_at=data.get("updated_at"),
                completion_notes=data.get("completion_notes")
            )
        except Exception as e:
            logger.error(f"Error converting appointment data: {str(e)}")
            return None

    @staticmethod
    def update_dict(appointment_id: str, update_data: AppointmentUpdate) -> Dict:
        """Convert update data to dictionary for MongoDB update"""
        update_dict = {}
        
        # Handle each field individually to convert date/time objects to strings
        for k, v in update_data.dict().items():
            if v is not None:
                if k == "appointment_date" and hasattr(v, 'isoformat'):
                    update_dict[k] = v.isoformat()
                elif k == "appointment_time" and hasattr(v, 'isoformat'):
                    update_dict[k] = v.isoformat()
                else:
                    update_dict[k] = v
        
        if not update_dict:
            raise ValueError("No valid fields to update")
        
        # Add updated timestamp
        update_dict["updated_at"] = datetime.utcnow()
        
        return update_dict