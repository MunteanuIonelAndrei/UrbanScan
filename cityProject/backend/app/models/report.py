from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Report(Base):
    id = Column(Integer, primary_key=True, index=True)
    # Unique report ID (used in URLs and for folder names)
    report_id = Column(String, unique=True, index=True, nullable=False)
    # Problem details
    problem_details = Column(Text, nullable=False)
    # Location
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    # Status
    status = Column(String, default="new", nullable=False)  # new, in_progress, resolved
    # Resolution
    resolution_note = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    # AI analysis
    ai_analysis = Column(Text, nullable=True)  # Legacy field for backward compatibility
    ai_analyzed = Column(Boolean, default=False)  # Whether the report was analyzed by AI
    ai_category = Column(String, nullable=True)  # Problem category (infrastructure, safety, etc.)
    ai_severity = Column(String, nullable=True)  # Problem severity (critical, high, medium, low)
    ai_department = Column(String, nullable=True)  # Responsible department
    ai_is_valid = Column(Boolean, default=True)  # Whether report appears valid 
    ai_invalid_reason = Column(Text, nullable=True)  # Reason why the report is invalid if ai_is_valid is False
    ai_details = Column(JSON, nullable=True)  # Full AI analysis as JSON for future use
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Relationships
    photos = relationship("Photo", back_populates="report", cascade="all, delete-orphan")