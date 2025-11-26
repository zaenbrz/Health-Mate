from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv
import asyncio
from ..models.appointment import AppointmentReminder, AppointmentResponse, AppointmentStatus
from ..models.notification import Notification, NotificationType, NotificationPriority, NotificationResponse
from bson import ObjectId

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db=None):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@healthmate.com")
        self.app_name = "HealthMate"
        self.db = db
        
        # In-memory storage for sent reminders (replace with database in production)
        self.sent_reminders: Dict[str, AppointmentReminder] = {}

    async def send_appointment_confirmation(self, appointment: AppointmentResponse) -> bool:
        """
        Send appointment confirmation email to patient.
        """
        try:
            subject = f"Appointment Confirmed - {self.app_name}"
            message = self._create_confirmation_message(appointment)
            
            success = await self._send_email(
                to_email=appointment.patient_email,
                subject=subject,
                message=message
            )
            
            if success:
                # Record the sent reminder
                reminder = AppointmentReminder(
                    appointment_id=appointment.id,
                    patient_email=appointment.patient_email,
                    doctor_email=appointment.doctor_email,
                    appointment_date=appointment.appointment_date,
                    appointment_time=appointment.appointment_time,
                    reminder_type="confirmation",
                    message=message,
                    sent_at=datetime.now()
                )
                self.sent_reminders[f"{appointment.id}_confirmation"] = reminder
                
                logger.info(f"Appointment confirmation sent to {appointment.patient_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending appointment confirmation: {str(e)}")
            return False

    async def send_appointment_reminder_24h(self, appointment: AppointmentResponse) -> bool:
        """
        Send 24-hour appointment reminder.
        """
        try:
            subject = f"Appointment Reminder - Tomorrow - {self.app_name}"
            message = self._create_24h_reminder_message(appointment)
            
            success = await self._send_email(
                to_email=appointment.patient_email,
                subject=subject,
                message=message
            )
            
            if success:
                # Record the sent reminder
                reminder = AppointmentReminder(
                    appointment_id=appointment.id,
                    patient_email=appointment.patient_email,
                    doctor_email=appointment.doctor_email,
                    appointment_date=appointment.appointment_date,
                    appointment_time=appointment.appointment_time,
                    reminder_type="reminder_24h",
                    message=message,
                    sent_at=datetime.now()
                )
                self.sent_reminders[f"{appointment.id}_24h"] = reminder
                
                logger.info(f"24h appointment reminder sent to {appointment.patient_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending 24h appointment reminder: {str(e)}")
            return False

    async def send_appointment_reminder_1h(self, appointment: AppointmentResponse) -> bool:
        """
        Send 1-hour appointment reminder.
        """
        try:
            subject = f"Appointment Starting Soon - {self.app_name}"
            message = self._create_1h_reminder_message(appointment)
            
            success = await self._send_email(
                to_email=appointment.patient_email,
                subject=subject,
                message=message
            )
            
            if success:
                # Record the sent reminder
                reminder = AppointmentReminder(
                    appointment_id=appointment.id,
                    patient_email=appointment.patient_email,
                    doctor_email=appointment.doctor_email,
                    appointment_date=appointment.appointment_date,
                    appointment_time=appointment.appointment_time,
                    reminder_type="reminder_1h",
                    message=message,
                    sent_at=datetime.now()
                )
                self.sent_reminders[f"{appointment.id}_1h"] = reminder
                
                logger.info(f"1h appointment reminder sent to {appointment.patient_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending 1h appointment reminder: {str(e)}")
            return False

    async def send_appointment_cancellation(self, appointment: AppointmentResponse) -> bool:
        """
        Send appointment cancellation notification.
        """
        try:
            subject = f"Appointment Cancelled - {self.app_name}"
            message = self._create_cancellation_message(appointment)
            
            success = await self._send_email(
                to_email=appointment.patient_email,
                subject=subject,
                message=message
            )
            
            if success:
                logger.info(f"Appointment cancellation sent to {appointment.patient_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending appointment cancellation: {str(e)}")
            return False

    async def send_medication_reminder(self, patient_email: str, medications: List[str], 
                                     appointment: AppointmentResponse) -> bool:
        """
        Send medication reminder based on appointment and prescribed medications.
        """
        try:
            subject = f"Medication Reminder - {self.app_name}"
            message = self._create_medication_reminder_message(medications, appointment)
            
            success = await self._send_email(
                to_email=patient_email,
                subject=subject,
                message=message
            )
            
            if success:
                logger.info(f"Medication reminder sent to {patient_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending medication reminder: {str(e)}")
            return False

    async def schedule_appointment_reminders(self, appointment: AppointmentResponse):
        """
        Schedule all necessary reminders for an appointment.
        """
        try:
            # Schedule 24-hour reminder
            appointment_datetime = datetime.combine(appointment.appointment_date, appointment.appointment_time)
            reminder_24h_time = appointment_datetime - timedelta(hours=24)
            
            # Schedule 1-hour reminder
            reminder_1h_time = appointment_datetime - timedelta(hours=1)
            
            # Schedule the reminders (in production, use a task queue like Celery)
            if reminder_24h_time > datetime.now():
                await self._schedule_reminder(reminder_24h_time, self.send_appointment_reminder_24h, appointment)
            
            if reminder_1h_time > datetime.now():
                await self._schedule_reminder(reminder_1h_time, self.send_appointment_reminder_1h, appointment)
            
            logger.info(f"Appointment reminders scheduled for {appointment.id}")
            
        except Exception as e:
            logger.error(f"Error scheduling appointment reminders: {str(e)}")

    async def _schedule_reminder(self, reminder_time: datetime, reminder_func, appointment: AppointmentResponse):
        """
        Schedule a reminder to be sent at a specific time.
        In production, this would use a proper task scheduler.
        """
        try:
            delay = (reminder_time - datetime.now()).total_seconds()
            if delay > 0:
                await asyncio.sleep(delay)
                await reminder_func(appointment)
        except Exception as e:
            logger.error(f"Error in scheduled reminder: {str(e)}")

    async def _send_email(self, to_email: str, subject: str, message: str) -> bool:
        """
        Send email using SMTP.
        """
        try:
            if not self.smtp_username or not self.smtp_password:
                logger.warning("SMTP credentials not configured. Email not sent.")
                return False
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body to email
            msg.attach(MIMEText(message, 'html'))
            
            # Create SMTP session
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            
            # Send email
            text = msg.as_string()
            server.sendmail(self.from_email, to_email, text)
            server.quit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            return False

    def _create_confirmation_message(self, appointment: AppointmentResponse) -> str:
        """Create HTML confirmation message."""
        return f"""
        <html>
        <body>
            <h2>Appointment Confirmed</h2>
            <p>Dear Patient,</p>
            <p>Your appointment has been confirmed with the following details:</p>
            <ul>
                <li><strong>Date:</strong> {appointment.appointment_date}</li>
                <li><strong>Time:</strong> {appointment.appointment_time}</li>
                <li><strong>Duration:</strong> {appointment.duration_minutes} minutes</li>
                <li><strong>Type:</strong> {appointment.appointment_type}</li>
                <li><strong>Urgency:</strong> {appointment.urgency_level}</li>
            </ul>
            <p>Please arrive 10 minutes before your scheduled time.</p>
            <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
            <p>Best regards,<br>{self.app_name} Team</p>
        </body>
        </html>
        """

    def _create_24h_reminder_message(self, appointment: AppointmentResponse) -> str:
        """Create HTML 24-hour reminder message."""
        return f"""
        <html>
        <body>
            <h2>Appointment Reminder - Tomorrow</h2>
            <p>Dear Patient,</p>
            <p>This is a reminder that you have an appointment tomorrow:</p>
            <ul>
                <li><strong>Date:</strong> {appointment.appointment_date}</li>
                <li><strong>Time:</strong> {appointment.appointment_time}</li>
                <li><strong>Duration:</strong> {appointment.duration_minutes} minutes</li>
            </ul>
            <p>Please prepare any relevant medical documents or questions you may have.</p>
            <p>If you need to reschedule, please contact us immediately.</p>
            <p>Best regards,<br>{self.app_name} Team</p>
        </body>
        </html>
        """

    def _create_1h_reminder_message(self, appointment: AppointmentResponse) -> str:
        """Create HTML 1-hour reminder message."""
        return f"""
        <html>
        <body>
            <h2>Appointment Starting Soon</h2>
            <p>Dear Patient,</p>
            <p>Your appointment is scheduled to start in 1 hour:</p>
            <ul>
                <li><strong>Time:</strong> {appointment.appointment_time}</li>
                <li><strong>Duration:</strong> {appointment.duration_minutes} minutes</li>
            </ul>
            <p>Please ensure you are ready and have all necessary documents.</p>
            <p>Best regards,<br>{self.app_name} Team</p>
        </body>
        </html>
        """

    def _create_cancellation_message(self, appointment: AppointmentResponse) -> str:
        """Create HTML cancellation message."""
        return f"""
        <html>
        <body>
            <h2>Appointment Cancelled</h2>
            <p>Dear Patient,</p>
            <p>Your appointment has been cancelled:</p>
            <ul>
                <li><strong>Date:</strong> {appointment.appointment_date}</li>
                <li><strong>Time:</strong> {appointment.appointment_time}</li>
            </ul>
            <p>If you need to reschedule, please contact us to book a new appointment.</p>
            <p>Best regards,<br>{self.app_name} Team</p>
        </body>
        </html>
        """

    def _create_medication_reminder_message(self, medications: List[str], appointment: AppointmentResponse) -> str:
        """Create HTML medication reminder message."""
        medication_list = "\n".join([f"<li>{med}</li>" for med in medications])
        
        return f"""
        <html>
        <body>
            <h2>Medication Reminder</h2>
            <p>Dear Patient,</p>
            <p>Please remember to take your prescribed medications:</p>
            <ul>
                {medication_list}
            </ul>
            <p>Your next appointment is scheduled for {appointment.appointment_date} at {appointment.appointment_time}.</p>
            <p>If you have any questions about your medications, please contact your doctor.</p>
            <p>Best regards,<br>{self.app_name} Team</p>
        </body>
        </html>
        """

    async def get_sent_reminders(self, appointment_id: str) -> List[AppointmentReminder]:
        """Get all sent reminders for an appointment."""
        reminders = []
        for key, reminder in self.sent_reminders.items():
            if reminder.appointment_id == appointment_id:
                reminders.append(reminder)
        return reminders

    async def send_bulk_reminders(self, appointments: List[AppointmentResponse], reminder_type: str):
        """
        Send bulk reminders for multiple appointments.
        """
        try:
            success_count = 0
            for appointment in appointments:
                if reminder_type == "confirmation":
                    success = await self.send_appointment_confirmation(appointment)
                elif reminder_type == "24h":
                    success = await self.send_appointment_reminder_24h(appointment)
                elif reminder_type == "1h":
                    success = await self.send_appointment_reminder_1h(appointment)
                else:
                    continue
                
                if success:
                    success_count += 1
            
            logger.info(f"Bulk reminders sent: {success_count}/{len(appointments)}")
            return success_count
            
        except Exception as e:
            logger.error(f"Error sending bulk reminders: {str(e)}")
            return 0

    # New notification methods for in-app notifications
    
    def create_notification(self, notification: Notification) -> Optional[NotificationResponse]:
        """Create a new in-app notification"""
        try:
            if self.db is None:
                logger.warning("Database not configured for notifications")
                return None
                
            notification_dict = notification.dict()
            notification_dict["created_at"] = datetime.utcnow()
            notification_dict["read"] = False
            
            result = self.db.notifications.insert_one(notification_dict)
            notification_dict["_id"] = result.inserted_id
            
            logger.info(f"Notification created for {notification.user_email}: {notification.title}")
            return NotificationResponse.from_dict(notification_dict)
            
        except Exception as e:
            logger.error(f"Error creating notification: {str(e)}")
            return None
    
    def notify_appointment_booked(self, appointment: AppointmentResponse, patient_name: str) -> bool:
        """Notify patient that appointment was booked successfully"""
        try:
            notification = Notification(
                user_email=appointment.patient_email,
                type=NotificationType.APPOINTMENT_BOOKED,
                title="Appointment Booked Successfully",
                message=f"Your {appointment.appointment_type} appointment has been scheduled for {appointment.appointment_date} at {appointment.appointment_time}.",
                priority=NotificationPriority.HIGH,
                data={
                    "appointment_id": appointment.id,
                    "appointment_date": str(appointment.appointment_date),
                    "appointment_time": str(appointment.appointment_time),
                    "appointment_type": appointment.appointment_type
                }
            )
            
            result = self.create_notification(notification)
            return result is not None
            
        except Exception as e:
            logger.error(f"Error sending appointment booked notification: {str(e)}")
            return False
    
    def notify_new_appointment_to_doctor(self, appointment: AppointmentResponse, patient_name: str) -> bool:
        """Notify doctor of new appointment"""
        try:
            notification = Notification(
                user_email=appointment.doctor_email,
                type=NotificationType.NEW_APPOINTMENT_FOR_DOCTOR,
                title="New Appointment Scheduled",
                message=f"New {appointment.appointment_type} appointment with {patient_name} on {appointment.appointment_date} at {appointment.appointment_time}.",
                priority=NotificationPriority.MEDIUM,
                data={
                    "appointment_id": appointment.id,
                    "patient_email": appointment.patient_email,
                    "patient_name": patient_name,
                    "appointment_date": str(appointment.appointment_date),
                    "appointment_time": str(appointment.appointment_time),
                    "appointment_type": appointment.appointment_type
                }
            )
            
            result = self.create_notification(notification)
            return result is not None
            
        except Exception as e:
            logger.error(f"Error sending new appointment notification to doctor: {str(e)}")
            return False
    
    def notify_appointment_cancelled(self, appointment: AppointmentResponse, cancelled_by: str) -> bool:
        """Notify patient that appointment was cancelled by doctor"""
        try:
            notification = Notification(
                user_email=appointment.patient_email,
                type=NotificationType.APPOINTMENT_CANCELLED,
                title="Appointment Cancelled",
                message=f"Your {appointment.appointment_type} appointment scheduled for {appointment.appointment_date} at {appointment.appointment_time} has been cancelled by the doctor.",
                priority=NotificationPriority.URGENT,
                data={
                    "appointment_id": appointment.id,
                    "appointment_date": str(appointment.appointment_date),
                    "appointment_time": str(appointment.appointment_time),
                    "cancelled_by": cancelled_by
                }
            )
            
            result = self.create_notification(notification)
            return result is not None
            
        except Exception as e:
            logger.error(f"Error sending appointment cancelled notification: {str(e)}")
            return False
    
    def create_health_reminder_from_report(self, user_email: str, report_data: dict) -> bool:
        """Create health reminders based on AI recommendations from medical report"""
        try:
            if self.db is None or not report_data:
                return False
            
            recommendations = []
            
            # Extract recommendations from AI diagnosis
            if "ai_triage_diagnosis" in report_data:
                ai_diagnosis = report_data["ai_triage_diagnosis"]
                if "recommendations" in ai_diagnosis and ai_diagnosis["recommendations"]:
                    recommendations.extend(ai_diagnosis["recommendations"])
            
            # Extract from summary
            if "summary" in report_data and "key_recommendations" in report_data["summary"]:
                recommendations.extend(report_data["summary"]["key_recommendations"])
            
            # Create notifications for each recommendation
            for idx, recommendation in enumerate(recommendations[:3]):  # Limit to top 3
                notification = Notification(
                    user_email=user_email,
                    type=NotificationType.HEALTH_REMINDER,
                    title="Health Reminder",
                    message=f"💊 {recommendation}",
                    priority=NotificationPriority.MEDIUM,
                    data={
                        "source": "AI Medical Report",
                        "recommendation_index": idx
                    }
                )
                self.create_notification(notification)
            
            logger.info(f"Created {len(recommendations[:3])} health reminders for {user_email}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating health reminders: {str(e)}")
            return False
    
    def get_user_notifications(self, user_email: str, unread_only: bool = False) -> List[NotificationResponse]:
        """Get all notifications for a user"""
        try:
            if self.db is None:
                return []
            
            query = {"user_email": user_email}
            if unread_only:
                query["read"] = False
            
            notifications = list(self.db.notifications.find(query).sort("created_at", -1).limit(100))
            return [NotificationResponse.from_dict(n) for n in notifications]
            
        except Exception as e:
            logger.error(f"Error getting user notifications: {str(e)}")
            return []
    
    def mark_notification_read(self, notification_id: str) -> bool:
        """Mark a notification as read"""
        try:
            if self.db is None:
                return False
            
            result = self.db.notifications.update_one(
                {"_id": ObjectId(notification_id)},
                {"$set": {"read": True}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error marking notification as read: {str(e)}")
            return False


