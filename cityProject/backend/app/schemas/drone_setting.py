from typing import Optional
from datetime import datetime
from pydantic import BaseModel


# Shared properties
class DroneAISettingBase(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None


# Properties to receive via API on creation
class DroneAISettingCreate(DroneAISettingBase):
    pass


# Properties to receive via API on update
class DroneAISettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None


# Additional properties to return via API
class DroneAISetting(DroneAISettingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Specialized settings schema for the frontend
class DroneAISettingsUpdate(BaseModel):
    enabled: bool
    frame_type: str  # "regular", "thermal", or "both"
    regular_prompt: Optional[str] = None
    thermal_prompt: Optional[str] = None
    both_prompt: Optional[str] = None


class DroneAISettings(BaseModel):
    enabled: bool
    frame_type: str
    regular_prompt: str
    thermal_prompt: str
    both_prompt: str