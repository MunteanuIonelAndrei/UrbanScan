from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, declared_attr

from app.db.base_class import Base


class DroneReport(Base):
    __tablename__ = "dronereport"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True, nullable=False)
    
    # Report metadata
    timestamp = Column(DateTime(timezone=True), nullable=False)
    drone_id = Column(String, nullable=True)
    frame_type = Column(String, nullable=False)  # regular, thermal, or both
    
    # Location data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    altitude = Column(Float, nullable=True)
    location_description = Column(String, nullable=True)
    
    # Analysis results
    category = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    visible_details = Column(Text, nullable=True)  # For 'both' frame type
    thermal_details = Column(Text, nullable=True)  # For 'both' frame type
    recommendations = Column(Text, nullable=True)
    
    # Raw analysis data
    analysis_data = Column(JSON, nullable=True)
    
    # Status fields
    status = Column(String, default="new")  # new, in_progress, resolved, ignored
    has_been_viewed = Column(Boolean, default=False)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("user.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    photos = relationship("DroneReportPhoto", back_populates="report", cascade="all, delete-orphan")
    resolver = relationship("User", foreign_keys=[resolved_by])


class DroneReportPhoto(Base):
    __tablename__ = "dronereportphoto"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("dronereport.id", ondelete="CASCADE"), nullable=False)
    
    # File info
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    
    # Photo type
    photo_type = Column(String, nullable=False)  # regular or thermal
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship back to report
    report = relationship("DroneReport", back_populates="photos")