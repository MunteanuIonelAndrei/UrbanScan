from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


# Photo schemas
class DroneReportPhotoBase(BaseModel):
    photo_type: str


class DroneReportPhotoCreate(DroneReportPhotoBase):
    filename: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None


class DroneReportPhoto(DroneReportPhotoBase):
    id: int
    report_id: int
    filename: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Report schemas
class DroneReportBase(BaseModel):
    report_id: str
    timestamp: datetime
    drone_id: Optional[str] = None
    frame_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    location_description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    visible_details: Optional[str] = None
    thermal_details: Optional[str] = None
    recommendations: Optional[str] = None


class DroneReportCreate(DroneReportBase):
    analysis_data: Optional[Dict[str, Any]] = None


class DroneReportUpdate(BaseModel):
    status: Optional[str] = None
    has_been_viewed: Optional[bool] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None


class DroneReport(DroneReportBase):
    id: int
    analysis_data: Optional[Dict[str, Any]] = None
    status: str
    has_been_viewed: bool
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    photos: List[DroneReportPhoto] = []

    class Config:
        from_attributes = True

    # Include photos URLs for frontend display
    @property
    def photo_urls(self) -> Dict[str, str]:
        result = {}
        for photo in self.photos:
            if photo.photo_type == "regular":
                result["regular"] = f"/uploads/{photo.file_path}"
            elif photo.photo_type == "thermal":
                result["thermal"] = f"/uploads/{photo.file_path}"
        return result


# Simplified response for list views
class DroneReportList(BaseModel):
    id: int
    report_id: str
    timestamp: datetime
    category: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    status: str
    has_been_viewed: bool

    class Config:
        from_attributes = True