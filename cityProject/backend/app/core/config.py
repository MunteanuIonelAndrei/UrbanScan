import secrets
import os
from typing import List, Optional, Union, Dict, Any
from pydantic import AnyHttpUrl, PostgresDsn, field_validator, ValidationInfo
from pydantic_settings import BaseSettings
from pathlib import Path
import logging
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global lock for thread-safe settings updates (outside of the class)
_settings_lock = threading.Lock()

class Settings(BaseSettings):
    # Project information
    PROJECT_NAME: str = "City Problem Reporter"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "A platform for citizens to report city problems with photos and location data"
    
    # API
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CLIENT_ORIGIN: str = "http://localhost:3002"
    ADMIN_ORIGIN: str = "http://localhost:3001"
    
    # Frontend static files (for production)
    CLIENT_STATIC_DIR: str = "../frontend/client/build"
    ADMIN_STATIC_DIR: str = "../frontend/admin/build"
    
    # Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = "5435"
    POSTGRES_USER: str = "andrei"
    POSTGRES_PASSWORD: str = "andrei"
    POSTGRES_DB: str = "city_reporter"
    SQLALCHEMY_DATABASE_URI: Optional[PostgresDsn] = None
    
    @field_validator("SQLALCHEMY_DATABASE_URI", mode="before")
    def assemble_db_connection(cls, v: Optional[str], info: ValidationInfo) -> Any:
        if isinstance(v, str):
            return v
        
        values = info.data
        return PostgresDsn.build(
            scheme="postgresql",
            username=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values.get("POSTGRES_HOST"),
            port=values.get("POSTGRES_PORT"),
            path=f"{values.get('POSTGRES_DB') or ''}",
        )
    
    # Upload directory
    UPLOAD_DIR: str = "uploads"
    
    # OpenAI
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "sk-your-openai-api-key")
    OPENAI_MODEL: str = os.environ.get("OPENAI_MODEL", "gpt-4")
    OPENAI_VISION_MODEL: str = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")
    
    # AI Vision settings (will be overridden from DB)
    USE_VISION_API: bool = True  # Toggle to enable/disable Vision API analysis
    VISION_PROMPT: str = ""      # Will be loaded from DB
    
    # Drone settings (will be overridden from DB)
    DRONE_AI_ENABLED: bool = False
    DRONE_FRAME_TYPE: str = "regular"  # regular, thermal, or both
    
    # Debug mode
    DEBUG: bool = True
    
    # First admin user (created on startup if none exists)
    FIRST_ADMIN_USERNAME: str = "admin"
    FIRST_ADMIN_PASSWORD: str = "adminpassword"
    
    # Drone frames settings
    SAVE_DRONE_FRAMES: bool = True  # Whether to save drone frames to disk

    # Telegram integration
    TELEGRAM_NOTIFICATIONS_ENABLED: bool = False  # Will be overridden from DB
    TELEGRAM_BOT_TOKEN: str = ""                  # Will be overridden from DB
    TELEGRAM_CHAT_ID: str = ""                    # Will be overridden from DB
    TELEGRAM_NOTIFY_SEVERITY: List[str] = ["critical"]  # Which severity levels trigger notifications

    class Config:
        env_file = [".env", ".env.local", "../.env"]
        case_sensitive = True


# Create global settings object
settings = Settings()

# Ensure upload dir exists
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

def load_settings_from_db():
    """
    Load dynamic settings from database
    This is called at application startup and whenever settings are updated
    """
    # Import here to avoid circular imports
    try:
        from app.db.session import SessionLocal
        from app.models.system_setting import SystemSetting
        from app.models.drone_setting import DroneAISetting
        from app.utils import openaidrone

        db = SessionLocal()
        try:
            # Load report AI settings
            use_vision_api = db.query(SystemSetting).filter(SystemSetting.key == "use_vision_api").first()
            if use_vision_api:
                with _settings_lock:
                    settings.USE_VISION_API = use_vision_api.value.lower() == "true"
                logger.info(f"Loaded USE_VISION_API setting from DB: {settings.USE_VISION_API}")

            vision_prompt = db.query(SystemSetting).filter(SystemSetting.key == "vision_prompt").first()
            if vision_prompt:
                with _settings_lock:
                    settings.VISION_PROMPT = vision_prompt.value
                logger.info(f"Loaded VISION_PROMPT setting from DB: {bool(settings.VISION_PROMPT)}")

            # Load Telegram settings
            telegram_enabled = db.query(SystemSetting).filter(SystemSetting.key == "telegram_notifications_enabled").first()
            if telegram_enabled:
                with _settings_lock:
                    settings.TELEGRAM_NOTIFICATIONS_ENABLED = telegram_enabled.value.lower() == "true"
                logger.info(f"Loaded TELEGRAM_NOTIFICATIONS_ENABLED setting from DB: {settings.TELEGRAM_NOTIFICATIONS_ENABLED}")

            telegram_bot_token = db.query(SystemSetting).filter(SystemSetting.key == "telegram_bot_token").first()
            if telegram_bot_token:
                with _settings_lock:
                    settings.TELEGRAM_BOT_TOKEN = telegram_bot_token.value
                logger.info("Loaded TELEGRAM_BOT_TOKEN setting from DB")

            telegram_chat_id = db.query(SystemSetting).filter(SystemSetting.key == "telegram_chat_id").first()
            if telegram_chat_id:
                with _settings_lock:
                    settings.TELEGRAM_CHAT_ID = telegram_chat_id.value
                logger.info("Loaded TELEGRAM_CHAT_ID setting from DB")

            telegram_notify_severity = db.query(SystemSetting).filter(SystemSetting.key == "telegram_notify_severity").first()
            if telegram_notify_severity:
                with _settings_lock:
                    # Format is "critical,high,medium" etc.
                    severities = [s.strip() for s in telegram_notify_severity.value.split(",")]
                    settings.TELEGRAM_NOTIFY_SEVERITY = severities
                logger.info(f"Loaded TELEGRAM_NOTIFY_SEVERITY setting from DB: {settings.TELEGRAM_NOTIFY_SEVERITY}")

            # Load drone AI settings
            try:
                # Get current settings directly from the database
                current_settings = openaidrone.get_current_settings()
                logger.info(f"Drone AI settings loaded: enabled={current_settings['enabled']}, frame_type={current_settings['frame_type']}")
            except Exception as drone_err:
                logger.error(f"Error loading drone AI settings: {str(drone_err)}")

        except Exception as e:
            logger.error(f"Error loading settings from DB: {str(e)}")
        finally:
            db.close()
    except ImportError:
        # This happens when alembic is running the migration and the tables don't exist yet
        logger.info("Skipping DB settings load during migration")
        pass

# Don't load during migrations - will be loaded when application starts
if os.environ.get('ALEMBIC_CONFIG') is None:
    try:
        load_settings_from_db()
    except Exception as e:
        logger.error(f"Error during initial settings load: {str(e)}")