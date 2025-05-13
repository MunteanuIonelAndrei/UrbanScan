from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


# Shared properties
class PhotoBase(BaseModel):
    filename: str
    original_filename: Optional[str] = None
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    photo_type: Optional[str] = None


# Properties to receive on photo creation
class PhotoCreate(PhotoBase):
    report_id: int


# Properties to receive on photo update
class PhotoUpdate(BaseModel):
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    photo_type: Optional[str] = None


# Properties shared by models stored in DB
class PhotoInDBBase(PhotoBase):
    id: int
    report_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Properties to return to client
class Photo(PhotoInDBBase):
    url: str = None
    
    model_config = ConfigDict(from_attributes=True)
    
    def __init__(self, **data):
        super().__init__(**data)
        # Generate URL for frontend
        self.url = f"/uploads/{self.file_path}"


# Properties stored in DB
class PhotoInDB(PhotoInDBBase):
    pass