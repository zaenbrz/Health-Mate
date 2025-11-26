from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import auth_routes, chat_routes, profile_routes, appointment_routes, scan_routes, speech_routes, doctor_availability_routes, avatar_proxy_routes, animation_routes, report_routes, notification_routes
import logging
import time
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HealthMate API", version="1.0.0")

# Create media directories if they don't exist
media_dir = Path("media")
audio_dir = media_dir / "audio"
audio_dir.mkdir(parents=True, exist_ok=True)
logger.info(f"Media directory created/verified: {media_dir}")
logger.info(f"Audio directory created/verified: {audio_dir}")

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log incoming request
    logger.info(f"Incoming request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.info(f"Response: {response.status_code} - Process time: {process_time:.4f}s")
    
    return response

# Updated CORS configuration to allow all origins temporarily
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes with consistent prefixes
app.include_router(auth_routes.router, prefix="/auth", tags=["Authentication"])
app.include_router(chat_routes.router, prefix="/chat", tags=["Chat"])
app.include_router(profile_routes.router, prefix="/profile", tags=["Profile"])
app.include_router(appointment_routes.router, prefix="/appointments", tags=["Appointments"])
app.include_router(scan_routes.router, prefix="/scan", tags=["Scan Analysis"])
app.include_router(doctor_availability_routes.router, prefix="/doctor-availability", tags=["Doctor Availability"])
app.include_router(speech_routes.router, prefix="/speech", tags=["Speech"])
app.include_router(avatar_proxy_routes.router, prefix="/avatar", tags=["Avatar"])
app.include_router(animation_routes.router, prefix="/animations", tags=["Animations"])
app.include_router(report_routes.router, prefix="/reports", tags=["Medical Reports"])
app.include_router(notification_routes.router, prefix="/notifications", tags=["Notifications"])

# Mount static file directories
app.mount("/media", StaticFiles(directory="media"), name="media")
logger.info("Static media files mounted at /media")

@app.get("/")
async def root():
    return {"message": "HealthMate API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "HealthMate API is operational"}
