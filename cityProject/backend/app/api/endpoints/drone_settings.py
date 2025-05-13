import os
import time
from typing import Any, List, Optional, Dict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.utils import openaidrone

router = APIRouter()


@router.get("/ai-status", response_model=schemas.drone_setting.DroneAISettings)
def get_drone_ai_settings(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get the current drone AI analysis settings.
    """
    # Get settings directly from the database
    current_settings = openaidrone.get_current_settings()
    return current_settings


@router.post("/update-ai-settings", response_model=schemas.drone_setting.DroneAISettings)
async def update_drone_ai_settings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
    settings_update: schemas.drone_setting.DroneAISettingsUpdate = Body(...),
) -> Any:
    """
    Update drone AI analysis settings.
    """
    try:
        # Use the direct update function that interacts with the database
        openaidrone.update_settings(
            enabled=settings_update.enabled,
            frame_type=settings_update.frame_type,
            regular_prompt=settings_update.regular_prompt,
            thermal_prompt=settings_update.thermal_prompt,
            both_prompt=settings_update.both_prompt
        )

        # Return the freshly updated settings directly from the database
        return openaidrone.get_current_settings()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating drone AI settings: {str(e)}"
        )