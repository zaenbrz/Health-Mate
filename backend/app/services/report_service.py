"""
Medical Report Generation Service
Compiles user medical data into structured PDF reports
"""
from datetime import datetime
from typing import Dict, List, Optional
from io import BytesIO
import base64
import logging

logger = logging.getLogger(__name__)

class ReportService:
    """Service for generating medical reports"""
    
    @staticmethod
    def _format_list(items: list) -> str:
        """Format a list as bullet points or 'None' if empty"""
        if not items or len(items) == 0:
            return "   - None"
        return '\n'.join([f"   - {item}" for item in items])
    
    @staticmethod
    async def generate_medical_report(user_email: str) -> Dict:
        """
        Generate a comprehensive medical report for a user
        Retrieves all medical data and compiles into structured format
        """
        try:
            from ..database import db
            from ..models.user import UserModel
            from ..models.appointment import AppointmentModel
            from ..models.scan_report import ScanReportModel
            from .diagnosis_service import DiagnosisService
            
            # Get user profile
            user = UserModel.find_user_by_email(user_email)
            if not user:
                raise ValueError("User not found")
            
            # Get user's appointments (consultations)
            appointments = list(db.appointments.find({"patient_email": user_email}))
            
            # Get user's scan reports
            scan_reports = list(db.scan_reports.find({"patient_email": user_email}))
            
            # Extract diagnosis from conversation history
            diagnosis_service = DiagnosisService()
            diagnosis_data = await diagnosis_service.extract_diagnosis_from_conversations(user_email)
            
            # Compile report data
            report_data = {
                "report_id": f"MR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                "generated_at": datetime.utcnow().isoformat(),
                "patient_info": {
                    "name": user.get("name", "N/A"),
                    "email": user_email,
                    "age": user.get("age"),
                    "gender": user.get("gender"),
                    "phone": user.get("phone"),
                    "address": user.get("address"),
                    "blood_group": user.get("blood_group"),
                    "emergency_contact": user.get("emergency_contact")
                },
                "medical_history": {
                    "allergies": user.get("allergies", []),
                    "chronic_conditions": user.get("chronic_conditions", []),
                    "medications": user.get("medications", []),
                    "past_surgeries": user.get("past_surgeries", [])
                },
                "ai_triage_diagnosis": diagnosis_data,
                "consultations": [
                    {
                        "date": str(appt.get("appointment_date")),
                        "time": str(appt.get("appointment_time")),
                        "doctor": appt.get("doctor_email"),
                        "doctor_name": appt.get("doctor_name", "N/A"),
                        "type": appt.get("appointment_type"),
                        "status": appt.get("status"),
                        "duration_minutes": appt.get("duration_minutes", 30),
                        "notes": appt.get("notes", "")
                    }
                    for appt in sorted(appointments, key=lambda x: x.get("appointment_date", ""), reverse=True)
                ],
                "scan_reports": [
                    {
                        "report_id": report.get("report_id", str(report.get("_id"))),
                        "date": report.get("scan_date").isoformat() if report.get("scan_date") else "N/A",
                        "created_at": report.get("created_at").isoformat() if report.get("created_at") else "N/A",
                        "scan_type": report.get("scan_type", "Unknown"),
                        "insights": report.get("insights", []),
                        "recommendations": report.get("recommendations", []),
                        "segmentation_data": report.get("segmentation_data", {})
                    }
                    for report in sorted(scan_reports, key=lambda x: x.get("created_at", datetime.min), reverse=True)
                ],
                "summary": {
                    "total_consultations": len(appointments),
                    "total_scans": len(scan_reports),
                    "last_consultation": appointments[0].get("appointment_date") if appointments else None,
                    "last_scan": scan_reports[0].get("created_at").isoformat() if scan_reports and scan_reports[0].get("created_at") else None
                }
            }
            
            # Save report to database
            report_record = {
                "report_id": report_data["report_id"],
                "patient_email": user_email,
                "generated_at": datetime.utcnow(),
                "report_data": report_data,
                "status": "generated"
            }
            
            db.medical_reports.insert_one(report_record)
            
            logger.info(f"Medical report generated for {user_email}: {report_data['report_id']}")
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating medical report: {str(e)}")
            raise
    
    @staticmethod
    def generate_pdf_report(report_data: Dict) -> bytes:
        """
        Generate professional PDF medical report with graphics and formatting
        Uses ReportLab for advanced PDF generation
        """
        try:
            from reportlab.lib.pagesizes import letter, A4
            from reportlab.lib import colors
            from reportlab.lib.units import inch
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
            from reportlab.pdfgen import canvas
            from io import BytesIO
            
            # Create PDF buffer
            buffer = BytesIO()
            
            # Create PDF document
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                rightMargin=0.75*inch,
                leftMargin=0.75*inch,
                topMargin=1*inch,
                bottomMargin=0.75*inch
            )
            
            # Container for PDF elements
            elements = []
            
            # Define custom styles
            styles = getSampleStyleSheet()
            
            # Title style
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#667eea'),
                spaceAfter=30,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            # Heading style
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=14,
                textColor=colors.HexColor('#764ba2'),
                spaceAfter=12,
                spaceBefore=12,
                fontName='Helvetica-Bold',
                borderWidth=1,
                borderColor=colors.HexColor('#667eea'),
                borderPadding=5,
                backColor=colors.HexColor('#f0f4ff')
            )
            
            # Subheading style
            subheading_style = ParagraphStyle(
                'CustomSubheading',
                parent=styles['Heading3'],
                fontSize=12,
                textColor=colors.HexColor('#667eea'),
                spaceAfter=8,
                fontName='Helvetica-Bold'
            )
            
            # Body text style
            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.black,
                spaceAfter=6,
                alignment=TA_LEFT
            )
            
            # ==================== HEADER ====================
            elements.append(Paragraph("MEDICAL REPORT", title_style))
            
            # Report info table
            report_info_data = [
                ['Report ID:', report_data['report_id']],
                ['Generated:', datetime.fromisoformat(report_data['generated_at']).strftime('%B %d, %Y at %I:%M %p')]
            ]
            
            report_info_table = Table(report_info_data, colWidths=[1.5*inch, 4.5*inch])
            report_info_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(report_info_table)
            elements.append(Spacer(1, 20))
            
            # ==================== PATIENT INFORMATION ====================
            elements.append(Paragraph("👤 PATIENT INFORMATION", heading_style))
            
            patient_data = [
                ['Name:', report_data['patient_info']['name']],
                ['Email:', report_data['patient_info']['email']],
                ['Age:', str(report_data['patient_info'].get('age', 'N/A'))],
                ['Gender:', report_data['patient_info'].get('gender', 'N/A')],
                ['Phone:', report_data['patient_info'].get('phone', 'N/A')],
                ['Blood Group:', report_data['patient_info'].get('blood_group', 'N/A')],
                ['Emergency Contact:', report_data['patient_info'].get('emergency_contact', 'N/A')]
            ]
            
            patient_table = Table(patient_data, colWidths=[2*inch, 4.5*inch])
            patient_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#495057')),
                ('PADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(patient_table)
            elements.append(Spacer(1, 20))
            
            # ==================== MEDICAL HISTORY ====================
            elements.append(Paragraph("📋 MEDICAL HISTORY", heading_style))
            
            med_history = report_data.get('medical_history', {})
            history_data = [
                ['Allergies:', ', '.join(med_history.get('allergies', [])) or 'None recorded'],
                ['Chronic Conditions:', ', '.join(med_history.get('chronic_conditions', [])) or 'None recorded'],
                ['Current Medications:', ', '.join(med_history.get('medications', [])) or 'None recorded'],
                ['Past Surgeries:', ', '.join(med_history.get('past_surgeries', [])) or 'None recorded']
            ]
            
            history_table = Table(history_data, colWidths=[2*inch, 4.5*inch])
            history_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff8f0')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ffd89b')),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('PADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(history_table)
            elements.append(Spacer(1, 20))
            
            # ==================== AI MEDICAL TRIAGE ====================
            ai_diagnosis = report_data.get('ai_triage_diagnosis', {})
            if ai_diagnosis and ai_diagnosis.get('diagnosis_summary') != 'No triage conversations recorded':
                elements.append(Paragraph("🩺 AI MEDICAL TRIAGE ASSESSMENT", heading_style))
                
                # Diagnosis Summary
                elements.append(Paragraph("<b>Diagnosis Summary:</b>", subheading_style))
                diagnosis_text = ai_diagnosis.get('diagnosis_summary', 'No diagnosis available')
                elements.append(Paragraph(diagnosis_text, body_style))
                elements.append(Spacer(1, 10))
                
                # Symptoms
                if ai_diagnosis.get('symptoms_discussed'):
                    elements.append(Paragraph("<b>Symptoms Discussed:</b>", subheading_style))
                    for symptom in ai_diagnosis['symptoms_discussed']:
                        elements.append(Paragraph(f"• {symptom}", body_style))
                    elements.append(Spacer(1, 10))
                
                # Conditions
                if ai_diagnosis.get('conditions_mentioned'):
                    elements.append(Paragraph("<b>Conditions Mentioned:</b>", subheading_style))
                    for condition in ai_diagnosis['conditions_mentioned']:
                        elements.append(Paragraph(f"• {condition}", body_style))
                    elements.append(Spacer(1, 10))
                
                # Recommendations
                if ai_diagnosis.get('recommendations_given'):
                    elements.append(Paragraph("<b>AI Recommendations:</b>", subheading_style))
                    for rec in ai_diagnosis['recommendations_given']:
                        elements.append(Paragraph(f"• {rec}", body_style))
                    elements.append(Spacer(1, 10))
                
                # Specialist Referrals
                if ai_diagnosis.get('specialist_referrals'):
                    elements.append(Paragraph("<b>Specialist Referrals Suggested:</b>", subheading_style))
                    for specialist in ai_diagnosis['specialist_referrals']:
                        elements.append(Paragraph(f"• {specialist}", body_style))
                    elements.append(Spacer(1, 10))
                
                elements.append(Spacer(1, 10))
            
            # ==================== CONSULTATIONS ====================
            if report_data['consultations']:
                elements.append(PageBreak())
                elements.append(Paragraph(f"👨‍⚕️ CONSULTATIONS HISTORY ({len(report_data['consultations'])} total)", heading_style))
                
                for i, consult in enumerate(report_data['consultations'][:10], 1):
                    consult_data = [
                        [Paragraph(f"<b>Consultation #{i}</b>", body_style)],
                        [f"Date: {consult['date']} at {consult['time']}"],
                        [f"Doctor: {consult['doctor_name']} ({consult['doctor']})"],
                        [f"Type: {consult['type']} | Status: {consult['status']}"],
                        [f"Duration: {consult['duration_minutes']} minutes"],
                        [f"Notes: {consult['notes'] or 'No notes'}"]
                    ]
                    
                    consult_table = Table(consult_data, colWidths=[6.5*inch])
                    consult_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('PADDING', (0, 0), (-1, -1), 6),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    elements.append(consult_table)
                    elements.append(Spacer(1, 12))
                
                if len(report_data['consultations']) > 10:
                    elements.append(Paragraph(f"<i>+ {len(report_data['consultations']) - 10} more consultations not shown</i>", body_style))
            
            # ==================== SCAN REPORTS ====================
            if report_data['scan_reports']:
                elements.append(PageBreak())
                elements.append(Paragraph(f"🔬 SCAN REPORTS HISTORY ({len(report_data['scan_reports'])} total)", heading_style))
                
                for i, scan in enumerate(report_data['scan_reports'][:10], 1):
                    scan_data = [
                        [Paragraph(f"<b>Scan Report #{i}</b>", body_style)],
                        [f"Report ID: {scan['report_id']}"],
                        [f"Scan Date: {scan['date']}"],
                        [f"Type: {scan['scan_type']}"]
                    ]
                    
                    # Add insights
                    if scan.get('insights'):
                        scan_data.append([Paragraph("<b>Insights:</b>", body_style)])
                        for insight in scan['insights'][:3]:  # Show first 3
                            scan_data.append([f"  • {insight}"])
                    
                    # Add recommendations
                    if scan.get('recommendations'):
                        scan_data.append([Paragraph("<b>Recommendations:</b>", body_style)])
                        for rec in scan['recommendations'][:3]:  # Show first 3
                            scan_data.append([f"  • {rec}"])
                    
                    scan_table = Table(scan_data, colWidths=[6.5*inch])
                    scan_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4CAF50')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0fff4')),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#a5d6a7')),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('PADDING', (0, 0), (-1, -1), 6),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    elements.append(scan_table)
                    elements.append(Spacer(1, 12))
                
                if len(report_data['scan_reports']) > 10:
                    elements.append(Paragraph(f"<i>+ {len(report_data['scan_reports']) - 10} more scan reports not shown</i>", body_style))
            
            # ==================== SUMMARY ====================
            elements.append(PageBreak())
            elements.append(Paragraph("📊 SUMMARY", heading_style))
            
            summary_data = [
                ['Total Consultations:', str(report_data['summary']['total_consultations'])],
                ['Total Scans:', str(report_data['summary']['total_scans'])],
                ['Last Consultation:', report_data['summary']['last_consultation'] or 'None'],
                ['Last Scan:', report_data['summary']['last_scan'] or 'None']
            ]
            
            summary_table = Table(summary_data, colWidths=[2*inch, 4.5*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e3f2fd')),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#667eea')),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('PADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 30))
            
            # ==================== FOOTER ====================
            disclaimer_style = ParagraphStyle(
                'Disclaimer',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#666666'),
                alignment=TA_CENTER,
                spaceAfter=6
            )
            
            elements.append(Spacer(1, 20))
            elements.append(Paragraph("<b>IMPORTANT NOTICE</b>", disclaimer_style))
            elements.append(Paragraph(
                "This is an automatically generated medical report. For any questions or concerns, please consult with your healthcare provider.",
                disclaimer_style
            ))
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(f"Report generated by HealthMate System © {datetime.now().year} HealthMate. All rights reserved.", disclaimer_style))
            
            # Build PDF
            doc.build(elements)
            
            # Get PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            return pdf_bytes
            
        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}")
            raise
    
    @staticmethod
    async def get_user_reports(user_email: str) -> List[Dict]:
        """Get all reports for a user"""
        try:
            from ..database import db
            
            reports = list(db.medical_reports.find(
                {"patient_email": user_email},
                {"_id": 0}
            ).sort("generated_at", -1))
            
            return reports
            
        except Exception as e:
            logger.error(f"Error retrieving reports: {str(e)}")
            raise
    
    @staticmethod
    async def get_report_by_id(report_id: str, user_email: str) -> Optional[Dict]:
        """Get specific report by ID"""
        try:
            from ..database import db
            
            report = db.medical_reports.find_one({
                "report_id": report_id,
                "patient_email": user_email
            }, {"_id": 0})
            
            return report
            
        except Exception as e:
            logger.error(f"Error retrieving report: {str(e)}")
            raise
    
    @staticmethod
    async def delete_report(report_id: str, user_email: str) -> bool:
        """Delete a medical report"""
        try:
            from ..database import db
            result = db.medical_reports.delete_one({
                "report_id": report_id,
                "patient_email": user_email
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting report: {str(e)}")
            return False
    
    @staticmethod
    async def get_patient_latest_report(patient_email: str) -> Optional[Dict]:
        """Get the most recent report for a patient (for doctor access)"""
        try:
            from ..database import db
            from pymongo import DESCENDING
            report = db.medical_reports.find_one(
                {"patient_email": patient_email},
                {"_id": 0},
                sort=[("generated_at", DESCENDING)]
            )
            return report
        except Exception as e:
            logger.error(f"Error retrieving patient report: {str(e)}")
            return None
    
    @staticmethod
    async def generate_report_for_patient(patient_email: str) -> Dict:
        """Generate a medical report for a patient (for doctor access)"""
        return await ReportService.generate_medical_report(patient_email)
