from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Photo(Base):
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("report.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=True)
    file_path = Column(String, nullable=False)  # Path relative to UPLOAD_DIR
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    photo_type = Column(String, nullable=True)  # camera or upload
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    report = relationship("Report", back_populates="photos")