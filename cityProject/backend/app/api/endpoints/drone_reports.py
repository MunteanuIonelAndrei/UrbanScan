import os
import time
import base64
from typing import Any, List, Optional, Dict
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path as PathParam
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import models, schemas
from app.api import deps
from app.core.config import settings

router = APIRouter()


@router.get("/", response_model=List[schemas.drone_report.DroneReportList])
def get_drone_reports(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
) -> Any:
    """
    Get list of drone reports.
    """
    query = db.query(models.DroneReport)
    
    # Apply status filter if provided
    if status:
        query = query.filter(models.DroneReport.status == status)
    
    # Order by timestamp (newest first)
    query = query.order_by(desc(models.DroneReport.timestamp))
    
    # Paginate
    reports = query.offset(skip).limit(limit).all()
    
    return reports


@router.get("/{report_id}", response_model=schemas.drone_report.DroneReport)
def get_drone_report(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    report_id: str = PathParam(...),
) -> Any:
    """
    Get a specific drone report by ID.
    """
    report = db.query(models.DroneReport).filter(models.DroneReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    # Load the photos for this report
    photos = db.query(models.DroneReportPhoto).filter(
        models.DroneReportPhoto.report_id == report.id
    ).all()

    # Mark as viewed if not already
    if not report.has_been_viewed:
        report.has_been_viewed = True
        db.commit()

    # Make sure photos are loaded (fixes lazy loading issues)
    if not report.photos and photos:
        report.photos = photos

    return report


@router.put("/{report_id}", response_model=schemas.drone_report.DroneReport)
def update_drone_report(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    report_id: str = PathParam(...),
    report_update: schemas.drone_report.DroneReportUpdate,
) -> Any:
    """
    Update a drone report status.
    """
    report = db.query(models.DroneReport).filter(models.DroneReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Update fields from the update schema
    update_data = report_update.dict(exclude_unset=True)
    
    # If marking as resolved, add resolver info
    if update_data.get("status") == "resolved" and not report.resolved_at:
        update_data["resolved_at"] = datetime.now()
        update_data["resolved_by"] = current_user.id
    
    # Apply updates
    for field, value in update_data.items():
        setattr(report, field, value)
    
    db.commit()
    db.refresh(report)
    
    return report


@router.delete("/{report_id}")
def delete_drone_report(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    report_id: str = PathParam(...),
) -> Any:
    """
    Delete a drone report.
    """
    report = db.query(models.DroneReport).filter(models.DroneReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    # Delete the report
    db.delete(report)
    db.commit()

    return {"success": True, "message": f"Report {report_id} deleted successfully"}


@router.get("/statistics/summary", response_model=Dict[str, Any])
def get_drone_report_statistics(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get summary statistics about drone reports.
    """
    # Total number of reports
    total_reports = db.query(models.DroneReport).count()
    
    # Reports by status
    new_reports = db.query(models.DroneReport).filter(models.DroneReport.status == "new").count()
    in_progress_reports = db.query(models.DroneReport).filter(models.DroneReport.status == "in_progress").count()
    resolved_reports = db.query(models.DroneReport).filter(models.DroneReport.status == "resolved").count()
    ignored_reports = db.query(models.DroneReport).filter(models.DroneReport.status == "ignored").count()
    
    # Reports by severity
    critical_reports = db.query(models.DroneReport).filter(models.DroneReport.severity == "critical").count()
    high_reports = db.query(models.DroneReport).filter(models.DroneReport.severity == "high").count()
    medium_reports = db.query(models.DroneReport).filter(models.DroneReport.severity == "medium").count()
    low_reports = db.query(models.DroneReport).filter(models.DroneReport.severity == "low").count()
    
    # Reports by category (top 5)
    category_counts = db.query(
        models.DroneReport.category, 
        db.func.count(models.DroneReport.id).label("count")
    ).group_by(models.DroneReport.category).order_by(desc("count")).limit(5).all()
    
    category_stats = [{"category": category, "count": count} for category, count in category_counts]
    
    return {
        "total": total_reports,
        "by_status": {
            "new": new_reports,
            "in_progress": in_progress_reports,
            "resolved": resolved_reports,
            "ignored": ignored_reports
        },
        "by_severity": {
            "critical": critical_reports,
            "high": high_reports,
            "medium": medium_reports,
            "low": low_reports
        },
        "top_categories": category_stats
    }