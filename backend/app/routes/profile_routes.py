from fastapi import APIRouter, Depends, HTTPException
from ..models.user import UserModel
from ..services.appointment_service import AppointmentService
from ..utils.jwt import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Profile"])

@router.get("")
async def get_profile(current_user=Depends(get_current_user)):
    """Get user profile"""
    try:
        email = current_user.get("email") or current_user.get("sub")
        user = UserModel.get_user_profile(email)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("")
async def update_profile(profile: dict, current_user=Depends(get_current_user)):
    """Update user profile"""
    try:
        email = current_user.get("email") or current_user.get("sub")
        
        logger.info(f"Updating profile for {email} with data: {profile}")
        
        # Remove sensitive fields that shouldn't be updated through this endpoint
        profile.pop("password", None)
        profile.pop("email", None)  # Email shouldn't be changed
        profile.pop("role", None)   # Role shouldn't be changed
        
        success = UserModel.update_user(email, profile)
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"Profile updated successfully for {email}")
        return {"message": "Profile updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/patient/{patient_email}")
async def get_patient_details(patient_email: str, current_user=Depends(get_current_user)):
    """Get patient details - accessible by doctors who have appointments with the patient"""
    try:
        # Only doctors can access this endpoint
        if current_user.get("role") != "doctor":
            raise HTTPException(status_code=403, detail="Only doctors can access patient details")
        
        doctor_email = current_user.get("email") or current_user.get("sub")
        
        # Verify doctor has appointment with this patient
        appointment_service = AppointmentService()
        appointments = appointment_service.get_appointments_by_doctor_and_patient(doctor_email, patient_email)
        
        if not appointments or len(appointments) == 0:
            raise HTTPException(
                status_code=403, 
                detail="You can only access details of patients with whom you have appointments"
            )
        
        # Get patient profile
        patient = UserModel.get_user_profile(patient_email)
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Return patient details (exclude sensitive info like password)
        return {
            "name": patient.get("name"),
            "email": patient.get("email"),
            "phone": patient.get("phone"),
            "date_of_birth": patient.get("date_of_birth"),
            "gender": patient.get("gender"),
            "blood_group": patient.get("blood_group"),
            "medical_history": patient.get("medical_history", []),
            "allergies": patient.get("allergies", []),
            "current_medications": patient.get("current_medications", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching patient details: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")