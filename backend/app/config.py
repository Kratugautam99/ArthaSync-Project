"""
ArthaSync — Configuration (Phase 2)
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me-in-production"

    # Groq
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FAST_MODEL: str = "llama-3.1-8b-instant"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/arthasync"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 20

    # Streaming
    STREAM_CHUNK_SIZE: int = 10

    # ── Tally Prime ───────────────────────────────────────────────────────────
    TALLY_HOST: str = "localhost"
    TALLY_PORT: int = 9000
    TALLY_COMPANY: str = ""

    # Zoho Books OAuth 2.0
    ZOHO_CLIENT_ID: str = ""
    ZOHO_CLIENT_SECRET: str = ""
    ZOHO_REDIRECT_URI: str = "http://localhost:8000/api/zoho/callback"
    ZOHO_ORG_ID: str = ""
    ZOHO_REGION: str = "in"

    # YOLO (COCO pre-trained model)
    YOLO_MODEL: str = "yolov8n.pt"
    YOLO_CONFIDENCE: float = 0.5
    YOLO_MAX_DETECTIONS: int = 50


settings = Settings()
