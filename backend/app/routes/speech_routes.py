from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
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

# Request models
class TTSRequest(BaseModel):
    text: str
    language: str = "en"

class LipsyncRequest(BaseModel):
    text: str
    language: str = "en"

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

@router.post("/generate")
async def generate_speech(
    request: TTSRequest,
    current_user=Depends(get_current_user)
):
    """
    Generate speech audio from text using Piper TTS
    Returns audio URL and metadata
    """
    try:
        logger.info(f"TTS request from user: {current_user.get('email', 'unknown')}")
        logger.info(f"Text: {request.text[:100]}, Language: {request.language}")
        
        # Validate language
        if request.language not in ["en", "ur"]:
            logger.warning(f"Invalid language '{request.language}', defaulting to English")
            request.language = "en"
        
        # Generate speech
        result = await speech_service.generate_speech(request.text, request.language)
        
        return {
            "success": True,
            "audio_url": result["audio_url"],
            "filename": result["filename"],
            "duration": result["duration"],
            "language": request.language
        }
        
    except Exception as e:
        logger.error(f"Error generating speech: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lipsync")
async def generate_speech_with_lipsync(
    request: LipsyncRequest,
    current_user=Depends(get_current_user)
):
    """
    Generate speech audio + lip-sync viseme data using Piper TTS + Rhubarb
    Returns audio URL, viseme timeline, and metadata
    """
    try:
        logger.info(f"TTS+Lipsync request from user: {current_user.get('email', 'unknown')}")
        logger.info(f"Text: {request.text[:100]}, Language: {request.language}")
        
        # Validate language
        if request.language not in ["en", "ur"]:
            logger.warning(f"Invalid language '{request.language}', defaulting to English")
            request.language = "en"
        
        # Generate speech with lip-sync
        result = await speech_service.generate_speech_with_lipsync(request.text, request.language)
        
        return {
            "success": True,
            "audio_url": result["audio_url"],
            "filename": result["filename"],
            "duration": result["duration"],
            "visemes": result["visemes"],
            "language": request.language
        }
        
    except Exception as e:
        logger.error(f"Error generating speech with lipsync: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


