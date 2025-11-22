from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from ..services.speech_service import SpeechService
from ..utils.jwt import get_current_user
import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Speech"])

# Initialize service
speech_service = SpeechService()

@router.post("/transcribe")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    language: Optional[str] = Form("en"),
    current_user=Depends(get_current_user)
):
    """Transcribe audio to text using Whisper with multilingual support (en, ur)"""
    try:
        logger.info(f"Speech transcription request from user: {current_user.get('email', 'unknown')}")
        logger.info(f"Audio file: {audio_file.filename}, size: {audio_file.size}")
        logger.info(f"Requested language: {language}")
        logger.info(f"User data: {current_user}")
        
        # Validate language
        if language not in ["en", "ur"]:
            logger.warning(f"Invalid language '{language}', defaulting to English")
            language = "en"
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe audio with specified language
            transcription = await speech_service.transcribe_audio(temp_file_path, language)
            
            return {
                "transcription": transcription,
                "language": language,
                "filename": audio_file.filename,
                "file_size": len(content)
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/test")
async def test_speech_auth(current_user=Depends(get_current_user)):
    """Test endpoint to verify speech authentication"""
    return {
        "message": "Speech authentication working",
        "user": current_user.get("email", "unknown"),
        "role": current_user.get("role", "unknown")
    }

