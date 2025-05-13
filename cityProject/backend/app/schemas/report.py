from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from app.schemas.photo import Photo


# Coordinates model
class Coordinates(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


# AI Analysis details model
class AIAnalysis(BaseModel):
    analyzed: bool = False
    category: Optional[str] = None
    severity: Optional[str] = None
    department: Optional[str] = None
    is_valid: bool = True
    invalid_reason: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    analysis_text: Optional[str] = None  # Legacy field for backward compatibility


# Shared properties
class ReportBase(BaseModel):
    problem_details: str
    location: str
    status: Optional[str] = "new"
    resolution_note: Optional[str] = None


# Properties to receive on report creation
class ReportCreate(ReportBase):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# Properties to receive on report update
class ReportUpdate(BaseModel):
    problem_details: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    resolution_note: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# Properties shared by models stored in DB
class ReportInDBBase(ReportBase):
    id: int
    report_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[int] = None
    
    # AI analysis fields
    ai_analysis: Optional[str] = None
    ai_analyzed: Optional[bool] = False
    ai_category: Optional[str] = None
    ai_severity: Optional[str] = None
    ai_department: Optional[str] = None
    ai_is_valid: Optional[bool] = True
    ai_invalid_reason: Optional[str] = None
    ai_details: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)


# Properties to return to client
class Report(ReportInDBBase):
    photos: List[Photo] = []
    coordinates: Coordinates = Field(default_factory=Coordinates)
    ai: AIAnalysis = Field(default_factory=AIAnalysis)

    model_config = ConfigDict(from_attributes=True)
    
    def __init__(self, **data):
        super().__init__(**data)
        # Set coordinates from latitude and longitude
        self.coordinates = Coordinates(
            lat=self.latitude,
            lng=self.longitude
        )
        # Set AI analysis from ai fields
        self.ai = AIAnalysis(
            analyzed=self.ai_analyzed,
            category=self.ai_category,
            severity=self.ai_severity,
            department=self.ai_department,
            is_valid=self.ai_is_valid,
            invalid_reason=self.ai_invalid_reason,
            details=self.ai_details,
            analysis_text=self.ai_analysis
        )


# Properties properties stored in DB
class ReportInDB(ReportInDBBase):
    pass


# Report status update
class ReportStatusUpdate(BaseModel):
    status: str
    resolution_note: Optional[str] = None


# AI Analysis toggle update
class AIAnalysisToggle(BaseModel):
    enabled: bool


# Report list response
class ReportList(BaseModel):
    reports: List[Report]
    total: int


# Report filter options including AI fields
class ReportFilter(BaseModel):
    status: Optional[str] = None
    search: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    ai_analyzed: Optional[bool] = None
    ai_severity: Optional[str] = None
    ai_category: Optional[str] = None
    ai_is_valid: Optional[bool] = None