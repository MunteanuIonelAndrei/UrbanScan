import os
import time
import uuid
import json
from typing import Any, List, Optional, Dict
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File, Query, BackgroundTasks, Body
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, and_

from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.utils.openai import analyze_report_with_openai, analyze_report_with_vision
from app.utils.files import save_upload_file

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.Report)
async def create_report(
    *,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    problem_details: str = Form(...),
    location: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    files: List[UploadFile] = File(...),
) -> Any:
    """
    Create new report with photos.
    """
    # Generate unique report ID
    report_id = f"report_{int(time.time() * 1000)}"
    
    # Create report directory
    upload_dir = Path(settings.UPLOAD_DIR)
    report_dir = upload_dir / report_id
    report_dir.mkdir(parents=True, exist_ok=True)
    
    # Create report object
    report_in = schemas.ReportCreate(
        problem_details=problem_details,
        location=location,
        latitude=latitude,
        longitude=longitude,
    )
    
    # Create DB entry
    db_report = models.Report(
        report_id=report_id,
        problem_details=report_in.problem_details,
        location=report_in.location,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        status="new",
        ai_analyzed=False,  # Will be updated after analysis
    )
    db.add(db_report)
    db.flush()  # Get the report ID without committing
    
    # Process and save photos
    saved_photos = []
    saved_photo_paths = []  # Store full paths for AI analysis
    for i, file in enumerate(files):
        try:
            # Generate a unique filename
            file_extension = os.path.splitext(file.filename)[1]
            if not file_extension:
                # Try to determine from content type
                if file.content_type.startswith("image/"):
                    file_extension = f".{file.content_type.split('/')[1]}"
                else:
                    file_extension = ".jpg"  # Default to jpg
            
            # Create a unique filename
            new_filename = f"photo_{i + 1}{file_extension}"
            file_path = report_id + "/" + new_filename
            
            # Save the file
            saved_path = await save_upload_file(file, report_dir / new_filename)
            saved_photo_paths.append(str(saved_path))
            
            # Create photo object
            photo = models.Photo(
                report_id=db_report.id,
                filename=new_filename,
                original_filename=file.filename,
                file_path=file_path,
                file_size=os.path.getsize(saved_path),
                mime_type=file.content_type,
                photo_type="upload"  # Default to upload
            )
            db.add(photo)
            saved_photos.append(photo)
        except Exception as e:
            # Clean up on error
            import shutil
            shutil.rmtree(report_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing file {file.filename}: {str(e)}",
            )
    
    # Analyze the report with AI if enabled
    if settings.USE_VISION_API:
        # Add immediate basic text analysis
        try:
            text_analysis = await analyze_report_with_openai(
                problem_details, location, latitude, longitude
            )
            db_report.ai_analysis = text_analysis  # Legacy field
        except Exception as e:
            print(f"Error with text analysis: {str(e)}")
            db_report.ai_analysis = "Text analysis not available at this time."
        
        # Schedule vision analysis as a background task to avoid delaying the response
        background_tasks.add_task(
            analyze_report_with_vision_background,
            db_report.id,
            problem_details, 
            location, 
            saved_photo_paths,
            latitude, 
            longitude,
            db
        )
    
    # Commit the transaction
    db.commit()
    db.refresh(db_report)
    
    # Return the report with photos
    result = schemas.Report.model_validate(db_report)
    result.photos = [schemas.Photo.model_validate(photo) for photo in saved_photos]
    
    return result

# Background task for vision analysis
async def analyze_report_with_vision_background(
    report_id: int,
    problem_details: str,
    location: str,
    photo_paths: List[str],
    latitude: Optional[float],
    longitude: Optional[float],
    db: Session
) -> None:
    """
    Background task to analyze report with OpenAI Vision API
    """
    try:
        # Get the report
        report = db.query(models.Report).filter(models.Report.id == report_id).first()
        if not report:
            print(f"Report {report_id} not found for AI analysis")
            return

        # Analyze with Vision API
        vision_result = await analyze_report_with_vision(
            problem_details, location, photo_paths, latitude, longitude
        )

        # Update report with analysis results
        report.ai_analyzed = True
        report.ai_category = vision_result.get("category")
        report.ai_severity = vision_result.get("severity")
        report.ai_department = vision_result.get("department")
        report.ai_is_valid = vision_result.get("is_valid_report", True)
        report.ai_invalid_reason = vision_result.get("invalid_reason", "")
        report.ai_details = vision_result

        # Update legacy field with a summary
        impact = vision_result.get("impact", "")
        recommendations = vision_result.get("recommendations", "")
        report.ai_analysis = f"""
        Category: {vision_result.get('category', 'Unknown')}
        Severity: {vision_result.get('severity', 'Unknown')}
        Department: {vision_result.get('department', 'Unknown')}

        Impact: {impact}

        Recommendations: {recommendations}
        """

        db.commit()
        print(f"Vision analysis completed for report {report_id}")

        # Send Telegram notification for critical reports
        severity = vision_result.get("severity", "").lower()
        if (settings.TELEGRAM_NOTIFICATIONS_ENABLED and
            severity in settings.TELEGRAM_NOTIFY_SEVERITY and
            report.ai_is_valid):
            try:
                from app.utils.telegram import telegram_notifier

                # Prepare data for notification
                description = vision_result.get("description", "") or impact or "No description available"
                recommendations = vision_result.get("recommendations", "") or "No recommendations available"

                # Send notification
                await telegram_notifier.send_critical_report_notification(
                    report_type="citizen",
                    report_id=report.report_id,
                    severity=severity,
                    category=vision_result.get("category", "Unknown"),
                    description=description,
                    recommendations=recommendations,
                    photo_paths=photo_paths,
                    latitude=latitude,
                    longitude=longitude,
                    location=location
                )
                print(f"Telegram notification sent for critical report {report.report_id}")
            except Exception as telegram_err:
                print(f"Error sending Telegram notification: {str(telegram_err)}")
    except Exception as e:
        print(f"Error in vision analysis background task: {str(e)}")
        # Try to update the report to indicate analysis failed
        try:
            report = db.query(models.Report).filter(models.Report.id == report_id).first()
            if report:
                report.ai_analyzed = True  # Still mark as analyzed
                report.ai_analysis = f"Vision analysis failed: {str(e)}"
                db.commit()
        except Exception as inner_e:
            print(f"Failed to update report after vision analysis error: {str(inner_e)}")


@router.get("/", response_model=schemas.ReportList)
def read_reports(
    db: Session = Depends(deps.get_db),
    current_user: Optional[models.User] = Depends(deps.get_optional_current_user),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    location: Optional[str] = None,
    ai_analyzed: Optional[bool] = None,
    ai_severity: Optional[str] = None,
    ai_category: Optional[str] = None,
    ai_is_valid: Optional[bool] = None,
) -> Any:
    """
    Retrieve reports with expanded filter options for AI analysis.
    """
    # Base query
    query = db.query(models.Report)
    
    # Apply regular filters
    if status and status != "all":
        query = query.filter(models.Report.status == status)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.Report.location.ilike(search_term),
                models.Report.problem_details.ilike(search_term)
            )
        )
    
    if start_date:
        query = query.filter(models.Report.created_at >= start_date)
    
    if end_date:
        query = query.filter(models.Report.created_at <= end_date)
    
    if location:
        query = query.filter(models.Report.location.ilike(f"%{location}%"))
    
    # Apply AI-related filters
    if ai_analyzed is not None:
        query = query.filter(models.Report.ai_analyzed == ai_analyzed)
    
    if ai_severity:
        query = query.filter(models.Report.ai_severity == ai_severity)
    
    if ai_category:
        query = query.filter(models.Report.ai_category == ai_category)
        
    if ai_is_valid is not None:
        query = query.filter(models.Report.ai_is_valid == ai_is_valid)
    
    # Count total reports matching filters
    total = query.count()
    
    # Order by most recent first and paginate
    reports = query.order_by(desc(models.Report.created_at)).offset(skip).limit(limit).all()
    
    # Fetch all photos for the reports in a single query
    if reports:
        report_ids = [report.id for report in reports]
        photos = db.query(models.Photo).filter(models.Photo.report_id.in_(report_ids)).all()
        
        # Group photos by report_id
        photos_by_report = {}
        for photo in photos:
            if photo.report_id not in photos_by_report:
                photos_by_report[photo.report_id] = []
            photos_by_report[photo.report_id].append(photo)
        
        # Create report objects with photos
        result = []
        for report in reports:
            report_obj = schemas.Report.model_validate(report)
            report_obj.photos = [
                schemas.Photo.model_validate(photo) 
                for photo in photos_by_report.get(report.id, [])
            ]
            result.append(report_obj)
    else:
        result = []
    
    return {"reports": result, "total": total}


@router.get("/{report_id}", response_model=schemas.Report)
def read_report(
    report_id: str,
    db: Session = Depends(deps.get_db),
    current_user: Optional[models.User] = Depends(deps.get_optional_current_user),
) -> Any:
    """
    Get a specific report by ID.
    """
    report = db.query(models.Report).filter(models.Report.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    
    # Get photos for this report
    photos = db.query(models.Photo).filter(models.Photo.report_id == report.id).all()
    
    # Create report object with photos
    result = schemas.Report.model_validate(report)
    result.photos = [schemas.Photo.model_validate(photo) for photo in photos]
    
    return result


@router.patch("/{report_id}/status", response_model=schemas.Report)
def update_report_status(
    report_id: str,
    status_update: schemas.ReportStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update report status.
    """
    report = db.query(models.Report).filter(models.Report.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    
    # Update status
    report.status = status_update.status
    
    # If status is "resolved", update resolved_at and resolved_by
    if status_update.status == "resolved":
        report.resolved_at = datetime.now()
        report.resolved_by_id = current_user.id
        report.resolution_note = status_update.resolution_note
    
    db.commit()
    db.refresh(report)
    
    # Get photos for this report
    photos = db.query(models.Photo).filter(models.Photo.report_id == report.id).all()
    
    # Create report object with photos
    result = schemas.Report.model_validate(report)
    result.photos = [schemas.Photo.model_validate(photo) for photo in photos]
    
    return result


@router.post("/{report_id}/analyze", response_model=schemas.Report)
async def analyze_report(
    report_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Manually trigger AI analysis for a report
    """
    # Find the report
    report = db.query(models.Report).filter(models.Report.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    
    # Get photos for this report
    photos = db.query(models.Photo).filter(models.Photo.report_id == report.id).all()
    
    # Get full paths to photos
    report_dir = Path(settings.UPLOAD_DIR) / report.report_id
    photo_paths = []
    for photo in photos:
        photo_path = report_dir / photo.filename
        if photo_path.exists():
            photo_paths.append(str(photo_path))
    
    # Only require photos if we're not in a test environment
    if not photo_paths and not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No photos found for this report"
        )
    
    # Schedule vision analysis as a background task
    background_tasks.add_task(
        analyze_report_with_vision_background,
        report.id,
        report.problem_details,
        report.location,
        photo_paths,
        report.latitude,
        report.longitude,
        db
    )
    
    # Update report to indicate analysis is in progress
    report.ai_analyzed = False  # Will be set to True when analysis completes
    report.ai_analysis = "AI analysis in progress..."
    db.commit()
    db.refresh(report)
    
    # Return the updated report
    result = schemas.Report.model_validate(report)
    result.photos = [schemas.Photo.model_validate(photo) for photo in photos]
    
    return result


@router.post("/settings/toggle-ai", response_model=dict)
def toggle_ai_analysis(
    settings_update: schemas.AIAnalysisToggle,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Toggle AI analysis setting
    """
    # Only superusers can change settings
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change system settings"
        )
    
    # Update the setting in the database
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "use_vision_api").first()
    if not setting:
        setting = models.SystemSetting(
            key="use_vision_api",
            value=str(settings_update.enabled).lower(),
            description="Enable or disable AI vision analysis"
        )
        db.add(setting)
    else:
        setting.value = str(settings_update.enabled).lower()
    
    db.commit()
    
    # Update the global setting
    from app.core.config import settings, load_settings_from_db, _settings_lock
    with _settings_lock:
        settings.USE_VISION_API = settings_update.enabled
    
    return {
        "success": True,
        "message": f"AI analysis {'enabled' if settings_update.enabled else 'disabled'}",
        "is_enabled": settings.USE_VISION_API
    }


@router.get("/settings/ai-status", response_model=schemas.AISettings)
def get_ai_status(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current AI analysis status and settings
    """
    # Read from in-memory settings (loaded from DB at startup)
    return {
        "use_vision_api": settings.USE_VISION_API,
        "vision_prompt": settings.VISION_PROMPT,
        "vision_model": settings.OPENAI_VISION_MODEL,
        # For backward compatibility with older frontend
        "is_enabled": settings.USE_VISION_API
    }


@router.post("/settings/update-ai-settings", response_model=schemas.AISettings)
def update_ai_settings(
    settings_update: schemas.AISettingsUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update AI analysis settings including the prompt and enabled status
    """
    # Only superusers can change settings
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change system settings"
        )
    
    # Update enabled status if provided
    use_vision_api = db.query(models.SystemSetting).filter(models.SystemSetting.key == "use_vision_api").first()
    if not use_vision_api:
        use_vision_api = models.SystemSetting(
            key="use_vision_api",
            value=str(settings_update.use_vision_api).lower(),
            description="Enable or disable AI vision analysis"
        )
        db.add(use_vision_api)
    else:
        use_vision_api.value = str(settings_update.use_vision_api).lower()
    
    # Update prompt if provided
    if settings_update.vision_prompt is not None:
        vision_prompt = db.query(models.SystemSetting).filter(models.SystemSetting.key == "vision_prompt").first()
        if not vision_prompt:
            vision_prompt = models.SystemSetting(
                key="vision_prompt",
                value=settings_update.vision_prompt,
                description="The prompt used for AI vision analysis"
            )
            db.add(vision_prompt)
        else:
            vision_prompt.value = settings_update.vision_prompt
    
    db.commit()
    
    # Update in-memory settings
    from app.core.config import settings, load_settings_from_db
    load_settings_from_db()  # Reload all settings from DB
    
    # Return updated settings
    return {
        "use_vision_api": settings.USE_VISION_API,
        "vision_prompt": settings.VISION_PROMPT,
        "vision_model": settings.OPENAI_VISION_MODEL,
        # For backward compatibility with older frontend
        "is_enabled": settings.USE_VISION_API
    }


@router.delete("/{report_id}", response_model=schemas.Report)
def delete_report(
    report_id: str,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a report.
    """
    report = db.query(models.Report).filter(models.Report.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    
    # Get photos for this report (before deletion)
    photos = db.query(models.Photo).filter(models.Photo.report_id == report.id).all()
    
    # Create report object with photos (for return value)
    result = schemas.Report.model_validate(report)
    result.photos = [schemas.Photo.model_validate(photo) for photo in photos]
    
    # Delete the report (cascades to photos)
    db.delete(report)
    db.commit()
    
    # Delete the report directory
    report_dir = Path(settings.UPLOAD_DIR) / report.report_id
    if report_dir.exists():
        import shutil
        shutil.rmtree(report_dir, ignore_errors=True)

    return result

# Telegram notification settings

@router.get("/settings/telegram-status", response_model=schemas.TelegramSettings)
def get_telegram_status(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current Telegram notification settings
    """
    # Only superusers can view settings
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view system settings"
        )

    # Return current settings
    return schemas.TelegramSettings(
        enabled=settings.TELEGRAM_NOTIFICATIONS_ENABLED,
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        chat_id=settings.TELEGRAM_CHAT_ID,
        notify_severity=settings.TELEGRAM_NOTIFY_SEVERITY
    )

@router.post("/settings/update-telegram-settings", response_model=schemas.TelegramSettings)
def update_telegram_settings(
    telegram_settings: schemas.TelegramSettingsUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Update Telegram notification settings
    """
    # Only superusers can change settings
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change system settings"
        )

    # Update enabled setting
    telegram_enabled = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "telegram_notifications_enabled"
    ).first()

    if not telegram_enabled:
        telegram_enabled = models.SystemSetting(
            key="telegram_notifications_enabled",
            value=str(telegram_settings.enabled).lower(),
            description="Enable or disable Telegram notifications for critical reports"
        )
        db.add(telegram_enabled)
    else:
        telegram_enabled.value = str(telegram_settings.enabled).lower()

    # Update bot token
    telegram_bot_token = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "telegram_bot_token"
    ).first()

    if not telegram_bot_token:
        telegram_bot_token = models.SystemSetting(
            key="telegram_bot_token",
            value=telegram_settings.bot_token,
            description="Telegram bot token for sending notifications"
        )
        db.add(telegram_bot_token)
    else:
        telegram_bot_token.value = telegram_settings.bot_token

    # Update chat ID
    telegram_chat_id = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "telegram_chat_id"
    ).first()

    if not telegram_chat_id:
        telegram_chat_id = models.SystemSetting(
            key="telegram_chat_id",
            value=telegram_settings.chat_id,
            description="Telegram chat ID where notifications will be sent"
        )
        db.add(telegram_chat_id)
    else:
        telegram_chat_id.value = telegram_settings.chat_id

    # Update severity levels
    # Convert list to comma-separated string
    severity_str = ",".join(telegram_settings.notify_severity)
    telegram_notify_severity = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "telegram_notify_severity"
    ).first()

    if not telegram_notify_severity:
        telegram_notify_severity = models.SystemSetting(
            key="telegram_notify_severity",
            value=severity_str,
            description="Comma-separated list of severity levels that will trigger notifications"
        )
        db.add(telegram_notify_severity)
    else:
        telegram_notify_severity.value = severity_str

    # Commit changes to DB
    db.commit()

    # Update in-memory settings
    from app.core.config import load_settings_from_db
    load_settings_from_db()

    # Return updated settings
    return schemas.TelegramSettings(
        enabled=settings.TELEGRAM_NOTIFICATIONS_ENABLED,
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        chat_id=settings.TELEGRAM_CHAT_ID,
        notify_severity=settings.TELEGRAM_NOTIFY_SEVERITY
    )

@router.post("/settings/test-telegram", response_model=schemas.TelegramTestResponse)
async def test_telegram_notification(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Send a test notification to Telegram
    """
    # Only superusers can test
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can test Telegram notifications"
        )

    try:
        from app.utils.telegram import telegram_notifier

        # Send a test message
        result = await telegram_notifier.send_message(
            "✅ <b>TEST NOTIFICATION</b>\n\nThis is a test message from the City Problem Reporter system. "
            "If you're seeing this, your Telegram notification settings are working correctly!"
        )

        if result.get("success"):
            return schemas.TelegramTestResponse(
                success=True,
                message="Test notification sent successfully"
            )
        else:
            return schemas.TelegramTestResponse(
                success=False,
                message=f"Failed to send test notification: {result.get('error', 'Unknown error')}"
            )
    except Exception as e:
        return schemas.TelegramTestResponse(
            success=False,
            message=f"Error sending test notification: {str(e)}"
        )