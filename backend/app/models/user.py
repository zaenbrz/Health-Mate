from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime
from ..database import db
import logging

logger = logging.getLogger(__name__)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "patient"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    email: str
    role: str
    name: Optional[str] = None
    specialization: Optional[str] = None
    created_at: Optional[datetime] = None

class DoctorProfile(BaseModel):
    email: EmailStr
    name: str
    specialization: str
    experience_years: int
    consultation_fee: float
    availability: Dict = {}

class PatientProfile(BaseModel):
    email: EmailStr
    name: str
    age: Optional[int] = None
    medical_history: List[str] = []
    allergies: List[str] = []
    avatar_id: Optional[str] = None  # Ready Player Me avatar ID
    rpm_user_id: Optional[str] = None  # Ready Player Me user ID
    rpm_token: Optional[str] = None  # Ready Player Me user token for customization

class UserModel:
    """Database operations for User model"""
    
    @staticmethod
    def create_user(user_data: UserCreate) -> Dict:
        """Create a new user in the database"""
        try:
            user_doc = {
                "email": user_data.email,
                "password": user_data.password,  # Should be hashed before calling
                "role": user_data.role,
                "created_at": datetime.utcnow()
            }
            result = db.users.insert_one(user_doc)
            return {"id": str(result.inserted_id), "email": user_data.email}
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            raise

    @staticmethod
    def find_user_by_email(email: str) -> Optional[Dict]:
        """Find user by email"""
        try:
            return db.users.find_one({"email": email})
        except Exception as e:
            logger.error(f"Error finding user by email: {str(e)}")
            return None

    @staticmethod
    def update_user(email: str, update_data: Dict) -> bool:
        """Update user information"""
        try:
            # First check if user exists
            user = db.users.find_one({"email": email})
            if not user:
                logger.warning(f"User not found: {email}")
                return False
            
            logger.info(f"Updating user {email} with data: {update_data}")
            
            # Update the user
            result = db.users.update_one(
                {"email": email}, 
                {"$set": update_data}
            )
            
            logger.info(f"Update result - matched: {result.matched_count}, modified: {result.modified_count}")
            
            # Return True if user exists, regardless of whether data changed
            return True
        except Exception as e:
            logger.error(f"Error updating user: {str(e)}")
            return False

    @staticmethod
    def get_all_doctors() -> List[Dict]:
        """Get all doctors from database"""
        try:
            doctors = list(db.users.find(
                {"role": "doctor"}, 
                {"_id": 0, "password": 0}
            ))
            return doctors
        except Exception as e:
            logger.error(f"Error fetching doctors: {str(e)}")
            return []

    @staticmethod
    def get_user_profile(email: str) -> Optional[Dict]:
        """Get user profile without password"""
        try:
            return db.users.find_one(
                {"email": email}, 
                {"_id": 0, "password": 0}
            )
        except Exception as e:
            logger.error(f"Error fetching user profile: {str(e)}")
            return None