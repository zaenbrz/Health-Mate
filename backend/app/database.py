from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from app.config import MONGO_URI, DB_NAME
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up MongoDB client using Server API v1 (recommended for Atlas)
try:
    client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    logger.info("MongoDB client initialized successfully")

    # Ping MongoDB to ensure connection is successful
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB!")

    # Database reference
    db = client[DB_NAME]
    logger.info(f"Using database: {DB_NAME}")

    # Verify collections exist
    collections = db.list_collection_names()
    logger.info(f"Available collections: {collections}")

    # Ensure conversations collection exists
    if 'conversations' not in collections:
        db.create_collection('conversations')
        logger.info("Created conversations collection")
    
    # Ensure scan_reports collection exists
    if 'scan_reports' not in collections:
        db.create_collection('scan_reports')
        logger.info("Created scan_reports collection")
    
    # Ensure doctor availability collections exist
    if 'doctor_schedules' not in collections:
        db.create_collection('doctor_schedules')
        logger.info("Created doctor_schedules collection")
    
    if 'appointment_slots' not in collections:
        db.create_collection('appointment_slots')
        logger.info("Created appointment_slots collection")

except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise e

# Dependency function for FastAPI
def get_database():
    """FastAPI dependency to get database instance"""
    return db
