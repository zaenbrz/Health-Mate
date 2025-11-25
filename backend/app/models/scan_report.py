from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from enum import Enum
import uuid
import logging

logger = logging.getLogger(__name__)

class ScanType(str, Enum):
    BRAIN_MRI = "brain_mri"
    BREAST_ULTRASOUND = "breast_ultrasound"
    CT_SCAN = "ct_scan"

class ScanReportBase(BaseModel):
    patient_email: EmailStr
    scan_type: ScanType
    scan_date: datetime
    segmentation_data: Dict
    insights: List[str]
    recommendations: List[str]
    segmentation_overlay: str

class ScanReportCreate(ScanReportBase):
    pass

class ScanReportResponse(ScanReportBase):
    report_id: str
    created_at: datetime

class ScanReportUpdate(BaseModel):
    insights: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None

class ScanReportModel:
    """Database operations for Scan Report model"""
    
    @staticmethod
    def create_scan_report(report_data: ScanReportCreate) -> Dict:
        """Create a new scan report in the database"""
        try:
            from ..database import db
            
            report_doc = {
                "report_id": str(uuid.uuid4()),
                "patient_email": report_data.patient_email,
                "scan_type": report_data.scan_type,
                "scan_date": report_data.scan_date,
                "created_at": datetime.utcnow(),
                "segmentation_data": report_data.segmentation_data,
                "insights": report_data.insights,
                "recommendations": report_data.recommendations,
                "segmentation_overlay": report_data.segmentation_overlay
            }
            
            result = db.scan_reports.insert_one(report_doc)
            logger.info(f"Scan report created with ID: {report_doc['report_id']}")
            
            return {
                "success": True,
                "report_id": report_doc["report_id"],
                "message": "Scan report saved successfully"
            }
            
        except Exception as e:
            logger.error(f"Error creating scan report: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def find_report_by_id(report_id: str) -> Optional[Dict]:
        """Find scan report by report_id"""
        try:
            from ..database import db
            return db.scan_reports.find_one({"report_id": report_id})
        except Exception as e:
            logger.error(f"Error finding report by ID: {str(e)}")
            return None
    
    @staticmethod
    def get_patient_reports(patient_email: str) -> List[Dict]:
        """Get all reports for a patient"""
        try:
            from ..database import db
            reports = list(db.scan_reports.find(
                {"patient_email": patient_email},
                {"_id": 0, "segmentation_overlay": 0}  # Exclude large image data
            ).sort("scan_date", -1))
            return reports
        except Exception as e:
            logger.error(f"Error fetching patient reports: {str(e)}")
            return []
    
    @staticmethod
    def get_report_overlay(report_id: str) -> Optional[Dict]:
        """Get segmentation overlay for a specific report"""
        try:
            from ..database import db
            report = db.scan_reports.find_one(
                {"report_id": report_id},
                {"segmentation_overlay": 1, "scan_type": 1, "scan_date": 1}
            )
            return report
        except Exception as e:
            logger.error(f"Error fetching report overlay: {str(e)}")
            return None
    
    @staticmethod
    def update_report(report_id: str, update_data: ScanReportUpdate) -> bool:
        """Update scan report"""
        try:
            from ..database import db
            update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
            
            if not update_dict:
                return False
                
            result = db.scan_reports.update_one(
                {"report_id": report_id},
                {"$set": update_dict}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating report: {str(e)}")
            return False
    
    @staticmethod
    def delete_report(report_id: str) -> bool:
        """Delete scan report"""
        try:
            from ..database import db
            result = db.scan_reports.delete_one({"report_id": report_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting report: {str(e)}")
            return False