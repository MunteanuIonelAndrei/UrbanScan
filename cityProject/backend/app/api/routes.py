from fastapi import APIRouter

from app.api.endpoints import auth, reports, users, dashboard, drone_frames, drone_settings, drone_reports

# Create API router
api_router = APIRouter()

# Include routers for different endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(drone_frames.router, prefix="/drone-frames", tags=["drone_frames"])
api_router.include_router(drone_settings.router, prefix="/drone/settings", tags=["drone_settings"])
api_router.include_router(drone_reports.router, prefix="/drone/reports", tags=["drone_reports"])