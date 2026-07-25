"""
ArthaSync Backend - AI Operating System
FastAPI entry point with CORS, routing, and lifespan management
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.routes import chat, health, upload, tally, zoho, camera
from app.config import settings
from app.services.database_service import get_pool, close_pool

from app.routes import chat, health, upload, tally, zoho
from app.config import settings
from app.services.database_service import get_pool, close_pool

import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup and shutdown lifecycle."""
    print(f"🚀 ArthaSync backend starting — mode: {settings.ENVIRONMENT}")

    # Ensure database exists before creating the pool
    try:
        import asyncpg
        from app.services.database_service import _parse_dsn
        params = _parse_dsn()
        sys_params = params.copy()
        sys_params["database"] = "postgres"
        
        sys_conn = await asyncpg.connect(**sys_params)
        db_name = params["database"]
        exists = await sys_conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
        if not exists:
            print(f"🛠️ Creating database '{db_name}'...")
            await sys_conn.execute(f'CREATE DATABASE "{db_name}"')
        await sys_conn.close()
    except Exception as check_e:
        print(f"⚠️ Could not check/create database: {check_e}")

    # Warm up the DB connection pool at startup
    try:
        pool = await get_pool()
        ok_status = "✅ arthasync DB pool ready"
        
        # Auto-initialize database like Spring Boot (update if present, create if absent)
        # Using CREATE TABLE IF NOT EXISTS in init.sql allows this to run safely every time.
        init_sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "postgres-init", "init.sql"))
        if os.path.exists(init_sql_path):
            print("🔄 Running database initialization script...")
            with open(init_sql_path, "r", encoding="utf-8") as f:
                sql_script = f.read()
            async with pool.acquire() as conn:
                await conn.execute(sql_script)
            print("✅ Database schema initialized/updated successfully.")
        else:
            print(f"⚠️ init.sql not found at {init_sql_path}")
            
    except Exception as e:
        ok_status = f"⚠️  DB pool/init failed: {e} (app will still run)"
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

app.include_router(chat.router,   prefix="/api", tags=["chat"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(tally.router,  tags=["tally"])
app.include_router(zoho.router,   tags=["zoho"])
app.include_router(camera.router, tags=["camera"])


@app.get("/")
async def root():
    return {"name": "ArthaSync API", "version": "1.0.0", "status": "running"}
