"""
ArthaSync — Health Check Route
"""

from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.config import settings
from app.services.database_service import check_db_connection

router = APIRouter()


@router.get("/health")
async def health():
    groq_connected = bool(settings.GROQ_API_KEY and len(settings.GROQ_API_KEY) > 10)
    db_ok, db_status = await check_db_connection()
    return {
        "status": "ok",
        "groq_connected": groq_connected,
        "db_connected": db_ok,
        "db_status": db_status,
        "version": "1.0.0",
    }
