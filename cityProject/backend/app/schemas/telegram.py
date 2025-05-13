from typing import List, Dict, Optional, Any
from pydantic import BaseModel


class TelegramSettings(BaseModel):
    enabled: bool
    bot_token: str
    chat_id: str
    notify_severity: List[str]


class TelegramSettingsUpdate(BaseModel):
    enabled: bool
    bot_token: str
    chat_id: str
    notify_severity: List[str]


class TelegramTestResponse(BaseModel):
    success: bool
    message: str