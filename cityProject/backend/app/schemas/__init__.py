# Schemas package
from app.schemas.user import User, UserCreate, UserUpdate, UserInDB
from app.schemas.token import Token, TokenPayload
from app.schemas.report import Report, ReportCreate, ReportUpdate, ReportList, ReportStatusUpdate, AIAnalysisToggle, ReportFilter
from app.schemas.photo import Photo, PhotoCreate, PhotoUpdate
from app.schemas.system_setting import SystemSetting, SystemSettingCreate, SystemSettingUpdate, AISettings, AISettingsUpdate
from app.schemas.drone_setting import DroneAISetting, DroneAISettingCreate, DroneAISettingUpdate, DroneAISettings, DroneAISettingsUpdate
from app.schemas.drone_report import DroneReport, DroneReportCreate, DroneReportUpdate, DroneReportList, DroneReportPhoto, DroneReportPhotoCreate
from app.schemas.telegram import TelegramSettings, TelegramSettingsUpdate, TelegramTestResponse