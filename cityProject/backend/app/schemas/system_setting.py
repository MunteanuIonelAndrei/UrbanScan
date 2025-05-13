from typing import Optional
from datetime import datetime
from pydantic import BaseModel


# Shared properties
class SystemSettingBase(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None


# Properties to receive via API on creation
class SystemSettingCreate(SystemSettingBase):
    pass


# Properties to receive via API on update
class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None


# Additional properties to return via API
class SystemSetting(SystemSettingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# AI settings specific schemas
class AISettingsUpdate(BaseModel):
    use_vision_api: bool
    vision_prompt: Optional[str] = None


class AISettings(BaseModel):
    use_vision_api: bool
    vision_prompt: str
    vision_model: str
    is_enabled: bool = None  # For backward compatibility with older frontend