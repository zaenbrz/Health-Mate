"""
Medical Report Routes
Endpoints for generating, retrieving, and downloading medical reports
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from typing import List, Dict
from ..services.report_service import ReportService
from ..services.diagnosis_service import DiagnosisService
from ..services.notification_service import NotificationService
from ..utils.jwt import get_current_user
from ..database import get_database
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Medical Reports"])

report_service = ReportService()
diagnosis_service = DiagnosisService()

@router.post("/generate", response_model=Dict)
async def generate_medical_report(current_user=Depends(get_current_user), db = Depends(get_database)):
    """
    Generate a comprehensive medical report for the current user
    Retrieves all medical data (profile, appointments, scans) and compiles into structured format
    """
    try:
        user_email = current_user.get("email")
        
        # Only patients can generate their own reports
        # Doctors could be added later to generate reports for their patients
        if current_user.get("role") not in ["patient", "doctor"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only patients can generate medical reports"
            )
        
        # Generate the report
        report_data = await report_service.generate_medical_report(user_email)
        
        # Create health reminders from AI recommendations
        notification_service = NotificationService(db)
        notification_service.create_health_reminder_from_report(
            user_email,
            report_data.get("report_data", {})
        )
        
        return {
            "success": True,
            "message": "Medical report generated successfully",
            "report": report_data
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating medical report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate medical report"
        )

@router.get("/my-reports", response_model=List[Dict])
async def get_my_reports(current_user=Depends(get_current_user)):
    """
    Get all medical reports for the current user
    """
    try:
        user_email = current_user.get("email")
        reports = await report_service.get_user_reports(user_email)
        
        return reports
        
    except Exception as e:
        logger.error(f"Error retrieving reports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reports"
        )

@router.get("/download/{report_id}")
async def download_report(
    report_id: str,
    current_user=Depends(get_current_user)
):
    """
    Download a medical report as a professional PDF
    """
    try:
        user_email = current_user.get("email")
        
        # Get the report
        report = await report_service.get_report_by_id(report_id, user_email)
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        # Generate PDF content
        pdf_content = report_service.generate_pdf_report(report["report_data"])
        
        # Return as downloadable PDF file
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=medical_report_{report_id}.pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download report"
        )

@router.get("/{report_id}", response_model=Dict)
async def get_report(
    report_id: str,
    current_user=Depends(get_current_user)
):
    """
    Get a specific medical report by ID
    """
    try:
        user_email = current_user.get("email")
        
        report = await report_service.get_report_by_id(report_id, user_email)
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve report"
        )

@router.post("/share/{report_id}")
async def share_report(
    report_id: str,
    email: str,
    current_user=Depends(get_current_user)
):
    """
    Share a medical report via email (placeholder for now)
    In production, this would integrate with an email service
    """
    try:
        user_email = current_user.get("email")
        
        # Get the report
        report = await report_service.get_report_by_id(report_id, user_email)
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        # TODO: Implement email sending with SendGrid, AWS SES, or similar
        # For now, just return a success message with a download link
        
        logger.info(f"Report {report_id} shared to {email} by {user_email}")
        
        return {
            "success": True,
            "message": f"Report sharing link prepared for {email}",
            "download_url": f"/api/reports/download/{report_id}",
            "note": "Email integration pending - share the download link manually"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sharing report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to share report"
        )

@router.get("/diagnosis", response_model=Dict)
async def get_ai_diagnosis(current_user=Depends(get_current_user)):
    """
    Get AI-extracted diagnosis from conversation history
    Analyzes medical triage conversations and extracts structured diagnosis
    """
    try:
        user_email = current_user.get("email")
        
        diagnosis_data = await diagnosis_service.extract_diagnosis_from_conversations(user_email)
        
        return {
            "success": True,
            "diagnosis": diagnosis_data
        }
        
    except Exception as e:
        logger.error(f"Error extracting diagnosis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract diagnosis"
        )

@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    current_user=Depends(get_current_user)
):
    """
    Delete a medical report
    """
    try:
        user_email = current_user.get("email")
        
        success = await report_service.delete_report(report_id, user_email)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found or already deleted"
            )
        
        return {
            "success": True,
            "message": "Report deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete report"
        )

@router.get("/patient/{patient_email}/latest")
async def get_patient_latest_report(
    patient_email: str,
    current_user=Depends(get_current_user)
):
    """
    Get the latest medical report for a patient (doctor access only)
    """
    try:
        # Only doctors can access patient reports
        if current_user.get("role") != "doctor":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only doctors can access patient reports"
            )
        
        report = await report_service.get_patient_latest_report(patient_email)
        
        if not report:
            return {
                "success": True,
                "report": None,
                "message": "No reports found for this patient"
            }
        
        return {
            "success": True,
            "report": report
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving patient report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve patient report"
        )

@router.post("/patient/{patient_email}/generate")
async def generate_patient_report(
    patient_email: str,
    current_user=Depends(get_current_user)
):
    """
    Generate a medical report for a patient (doctor access only)
    """
    try:
        # Only doctors can generate reports for patients
        if current_user.get("role") != "doctor":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only doctors can generate patient reports"
            )
        
        # Generate the report
        report_data = await report_service.generate_report_for_patient(patient_email)
        
        return {
            "success": True,
            "message": "Medical report generated successfully for patient",
            "report": report_data
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating patient report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate patient report"
        )

