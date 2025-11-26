from typing import List, Dict, Optional
from datetime import datetime, date, time
import logging
from ..models.appointment import (
    AppointmentModel, AppointmentCreate, AppointmentUpdate, AppointmentResponse,
    AppointmentStatus
)
from ..models.user import UserModel
from ..database import db

logger = logging.getLogger(__name__)

class AppointmentService:
    """Appointment management service - handles all business logic"""

    def __init__(self):
        """Initialize the service and create necessary indexes"""
        try:
            db.appointments.create_index([("patient_email", 1)])
            db.appointments.create_index([("doctor_email", 1)])
            db.appointments.create_index([("appointment_date", 1)])
            db.appointments.create_index([("status", 1)])
            db.appointments.create_index([("doctor_email", 1), ("appointment_date", 1), ("appointment_time", 1)])
            logger.info("Successfully created indexes for appointments collection")
        except Exception as e:
            logger.error(f"Error creating indexes: {str(e)}")

    async def create_appointment(self, appointment_data: AppointmentCreate) -> AppointmentResponse:
        """Create a new appointment with atomic operation"""
        try:
            # Check if slot is available
            if not await self.is_slot_available(
                appointment_data.doctor_email,
                appointment_data.appointment_date,
                appointment_data.appointment_time
            ):
                raise ValueError("Appointment slot is not available")

            # Convert to dict for MongoDB storage
            appointment_doc = AppointmentModel.to_dict(appointment_data)

            # Atomic operation to create appointment
            result = db.appointments.insert_one(appointment_doc)

            if result.inserted_id:
                logger.info(f"Appointment created successfully: {appointment_doc['id']}")
                return AppointmentModel.from_dict(appointment_doc)
            else:
                raise Exception("Failed to create appointment")
        except ValueError as ve:
            logger.warning(f"Validation error: {str(ve)}")
            raise
        except Exception as e:
            logger.error(f"Error creating appointment: {str(e)}")
            raise

    async def get_appointment_by_id(self, appointment_id: str) -> Optional[AppointmentResponse]:
        """Get appointment by ID"""
        try:
            appointment = db.appointments.find_one({"id": appointment_id}, {"_id": 0})
            if appointment:
                return AppointmentModel.from_dict(appointment)
            return None
        except Exception as e:
            logger.error(f"Error fetching appointment by ID: {str(e)}")
            raise

    async def get_patient_appointments(self, patient_email: str) -> List[AppointmentResponse]:
        """Get all appointments for a patient"""
        try:
            appointments = list(db.appointments.find(
                {"patient_email": patient_email},
                {"_id": 0}
            ).sort("appointment_date", -1))

            return [AppointmentModel.from_dict(apt) for apt in appointments if apt]
        except Exception as e:
            logger.error(f"Error fetching patient appointments: {str(e)}")
            raise

    async def get_doctor_appointments(self, doctor_email: str) -> List[AppointmentResponse]:
        """Get all appointments for a doctor"""
        try:
            appointments = list(db.appointments.find(
                {"doctor_email": doctor_email},
                {"_id": 0}
            ).sort("appointment_date", -1))

            return [AppointmentModel.from_dict(apt) for apt in appointments if apt]
        except Exception as e:
            logger.error(f"Error fetching doctor appointments: {str(e)}")
            raise

    async def update_appointment(self, appointment_id: str, update_data: AppointmentUpdate) -> AppointmentResponse:
        """Update an appointment"""
        try:
            # Convert update data to dict
            update_dict = AppointmentModel.update_dict(appointment_id, update_data)

            # Atomic operation to update appointment
            result = db.appointments.update_one(
                {"id": appointment_id},
                {"$set": update_dict}
            )

            if result.modified_count > 0:
                updated_appointment = db.appointments.find_one({"id": appointment_id}, {"_id": 0})
                return AppointmentModel.from_dict(updated_appointment)
            else:
                raise ValueError("Appointment not found")
        except ValueError as ve:
            logger.warning(f"Validation error: {str(ve)}")
            raise
        except Exception as e:
            logger.error(f"Error updating appointment: {str(e)}")
            raise

    async def cancel_appointment(self, appointment_id: str) -> bool:
        """Cancel an appointment"""
        try:
            result = db.appointments.update_one(
                {"id": appointment_id},
                {
                    "$set": {
                        "status": AppointmentStatus.CANCELLED,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error cancelling appointment: {str(e)}")
            raise

    async def get_doctors(self) -> List[Dict]:
        """Get all doctors"""
        try:
            return UserModel.get_all_doctors()
        except Exception as e:
            logger.error(f"Error fetching doctors: {str(e)}")
            raise

    async def is_slot_available(self, doctor_email: str, appointment_date: date | str, appointment_time: time | str) -> bool:
        """Check if a specific slot is available for booking.
        Returns True if the slot is free, False if it is already booked or if there's an error.
        This is the central method for checking slot availability across the application."""
        try:
            # Convert date and time to string format if they're not already
            date_str = appointment_date.isoformat() if isinstance(appointment_date, date) else appointment_date
            time_str = appointment_time.isoformat() if isinstance(appointment_time, time) else appointment_time

            query = {
                "doctor_email": doctor_email,
                "appointment_date": date_str,
                "appointment_time": time_str,
                "status": {"$in": ["SCHEDULED", "CONFIRMED"]}
            }
            logger.info(f"Checking slot availability with query: {query}")
            existing_appointment = db.appointments.find_one(query)
            is_available = existing_appointment is None
            logger.info(f"Slot availability result: {is_available}")
            return is_available
        except Exception as e:
            logger.error(f"Error checking slot availability: {str(e)}")
            return False  # Assume slot is not available if there's an error to prevent double booking

    async def get_appointment_stats(self, doctor_email: str) -> Dict:
        """Get appointment statistics for a doctor"""
        try:
            pipeline = [
                {"$match": {"doctor_email": doctor_email}},
                {"$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }}
            ]

            stats = list(db.appointments.aggregate(pipeline))
            return {stat["_id"]: stat["count"] for stat in stats}
        except Exception as e:
            logger.error(f"Error getting appointment stats: {str(e)}")
            return {}

    async def get_upcoming_appointments(self, user_email: str, role: str) -> List[AppointmentResponse]:
        """Get upcoming appointments for a user"""
        try:
            today = date.today()
            query = {"appointment_date": {"$gte": today.isoformat()}}

            if role == "patient":
                query["patient_email"] = user_email
            elif role == "doctor":
                query["doctor_email"] = user_email
            else:
                raise ValueError("Invalid role")

            appointments = list(db.appointments.find(
                query,
                {"_id": 0}
            ).sort("appointment_date", 1).limit(10))

            return [AppointmentModel.from_dict(apt) for apt in appointments if apt]
        except Exception as e:
            logger.error(f"Error fetching upcoming appointments: {str(e)}")
            raise

    def get_appointments_by_doctor_and_patient(self, doctor_email: str, patient_email: str) -> List[Dict]:
        """Get all appointments between a specific doctor and patient"""
        try:
            appointments = list(db.appointments.find(
                {
                    "doctor_email": doctor_email,
                    "patient_email": patient_email
                },
                {"_id": 0}
            ))
            return appointments
        except Exception as e:
            logger.error(f"Error fetching appointments by doctor and patient: {str(e)}")
            return []