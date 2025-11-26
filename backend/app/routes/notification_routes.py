from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from ..database import get_database
from ..services.notification_service import NotificationService
from ..models.notification import NotificationResponse
from ..utils.jwt import get_current_user
import logging

router = APIRouter(tags=["notifications"])
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all notifications for the current user"""
    try:
        notification_service = NotificationService(db)
        notifications = notification_service.get_user_notifications(
            current_user["email"],
            unread_only=unread_only
        )
        return notifications
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notifications"
        )

@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark a notification as read"""
    try:
        notification_service = NotificationService(db)
        success = notification_service.mark_notification_read(notification_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        return {"message": "Notification marked as read"}
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notification as read"
        )

@router.get("/unread/count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get count of unread notifications"""
    try:
        notification_service = NotificationService(db)
        notifications = notification_service.get_user_notifications(
            current_user["email"],
            unread_only=True
        )
        return {"count": len(notifications)}
    except Exception as e:
        logger.error(f"Error getting unread count: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unread count"
        )
