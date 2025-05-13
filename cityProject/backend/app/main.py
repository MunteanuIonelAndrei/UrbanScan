from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
import time
import logging
from typing import List
from pathlib import Path

from app.api.routes import api_router
from app.core.config import settings
from app.db.session import engine, SessionLocal
from app import models
from app.core.security import get_password_hash

# Create the uploads directory if it doesn't exist
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create tables in the database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
origins = [
    settings.CLIENT_ORIGIN,
    settings.ADMIN_ORIGIN,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to log request timing
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.info(f"Request to {request.url.path} took {process_time:.4f} seconds")
    return response

# Exception handler for HTTPException
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail}
    )

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": settings.VERSION}

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Serve frontend static files in production
if not settings.DEBUG:
    # Mount client app
    client_static_dir = Path(settings.CLIENT_STATIC_DIR)
    if client_static_dir.exists():
        app.mount("/", StaticFiles(directory=str(client_static_dir), html=True), name="client")
    
    # Mount admin app
    admin_static_dir = Path(settings.ADMIN_STATIC_DIR)
    if admin_static_dir.exists():
        app.mount("/admin", StaticFiles(directory=str(admin_static_dir), html=True), name="admin")

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.PROJECT_NAME} version {settings.VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Upload directory: {settings.UPLOAD_DIR}")
    
    # Load settings from database
    from app.core.config import load_settings_from_db
    load_settings_from_db()
    
    # Create initial admin user if none exists
    create_initial_admin()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info(f"Shutting down {settings.PROJECT_NAME}")
    
    
def create_initial_admin():
    """Create the initial admin user if no users exist"""
    try:
        db = SessionLocal()
        user_count = db.query(models.User).count()
        
        if user_count == 0:
            logger.info("No users found. Creating initial admin user...")
            admin_user = models.User(
                username=settings.FIRST_ADMIN_USERNAME,
                hashed_password=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
                is_active=True,
                is_superuser=True
            )
            db.add(admin_user)
            db.commit()
            logger.info(f"Created initial admin user: {settings.FIRST_ADMIN_USERNAME}")
        else:
            logger.info(f"Found {user_count} existing users. Skipping admin creation.")
    except Exception as e:
        logger.error(f"Error creating initial admin user: {str(e)}")
    finally:
        db.close()