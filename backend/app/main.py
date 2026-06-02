"""
ArthaSync Backend - AI Operating System
FastAPI entry point with CORS, routing, and lifespan management
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.routes import chat, health, upload
from app.config import settings
from app.services.database_service import get_pool, close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup and shutdown lifecycle."""
    print(f"🚀 ArthaSync backend starting — mode: {settings.ENVIRONMENT}")

    # Warm up the DB connection pool at startup
    try:
        pool = await get_pool()
        ok_status = "✅ arthasync DB pool ready"
    except Exception as e:
        ok_status = f"⚠️  DB pool failed to start: {e} (app will still run)"
    print(ok_status)

    yield

    await close_pool()
    print("🛑 ArthaSync backend shutting down — DB pool closed")


app = FastAPI(
    title="ArthaSync API",
    description="AI Operating System for Business Finance",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(chat.router,   prefix="/api", tags=["chat"])
app.include_router(upload.router, prefix="/api", tags=["upload"])


@app.get("/")
async def root():
    return {"name": "ArthaSync API", "version": "1.0.0", "status": "running"}
