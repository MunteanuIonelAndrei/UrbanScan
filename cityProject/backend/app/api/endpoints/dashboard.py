from typing import Any, Dict, List
from datetime import datetime, timedelta
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, extract, desc, or_, and_

from app import models
from app.api import deps

router = APIRouter()


@router.get("/statistics")
def get_dashboard_statistics(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get dashboard statistics including both regular and drone reports
    """
    today = datetime.now().date()
    thirty_days_ago = datetime.now() - timedelta(days=30)

    # Regular reports statistics
    regular_total = db.query(func.count(models.Report.id)).scalar() or 0

    regular_today = db.query(func.count(models.Report.id)).filter(
        cast(models.Report.created_at, Date) == today
    ).scalar() or 0

    regular_resolved = db.query(func.count(models.Report.id)).filter(
        models.Report.status == "resolved"
    ).scalar() or 0

    regular_locations = db.query(func.count(func.distinct(models.Report.location))).scalar() or 0

    # Drone reports statistics
    drone_total = db.query(func.count(models.DroneReport.id)).scalar() or 0

    drone_today = db.query(func.count(models.DroneReport.id)).filter(
        cast(models.DroneReport.timestamp, Date) == today
    ).scalar() or 0

    drone_resolved = db.query(func.count(models.DroneReport.id)).filter(
        models.DroneReport.status == "resolved"
    ).scalar() or 0

    drone_locations = db.query(
        func.count(
            func.distinct(
                func.concat(
                    func.coalesce(models.DroneReport.latitude, 0),
                    ',',
                    func.coalesce(models.DroneReport.longitude, 0)
                )
            )
        )
    ).scalar() or 0

    # Combined totals
    total_reports = regular_total + drone_total
    reports_today = regular_today + drone_today
    resolved_reports = regular_resolved + drone_resolved
    unique_locations = regular_locations + drone_locations

    # Regular reports by date (last 30 days)
    regular_reports_by_date_query = db.query(
        cast(models.Report.created_at, Date).label('date'),
        func.count(models.Report.id).label('count')
    ).filter(
        models.Report.created_at >= thirty_days_ago
    ).group_by(
        cast(models.Report.created_at, Date)
    ).order_by(
        cast(models.Report.created_at, Date)
    ).all()

    regular_reports_by_date = {
        date.strftime("%Y-%m-%d"): count
        for date, count in regular_reports_by_date_query
    }

    # Drone reports by date (last 30 days)
    drone_reports_by_date_query = db.query(
        cast(models.DroneReport.timestamp, Date).label('date'),
        func.count(models.DroneReport.id).label('count')
    ).filter(
        models.DroneReport.timestamp >= thirty_days_ago
    ).group_by(
        cast(models.DroneReport.timestamp, Date)
    ).order_by(
        cast(models.DroneReport.timestamp, Date)
    ).all()

    drone_reports_by_date = {
        date.strftime("%Y-%m-%d"): count
        for date, count in drone_reports_by_date_query
    }

    # Combine both report dates
    all_dates = set(regular_reports_by_date.keys()) | set(drone_reports_by_date.keys())
    combined_reports_by_date = [
        {
            "date": date,
            "regularCount": regular_reports_by_date.get(date, 0),
            "droneCount": drone_reports_by_date.get(date, 0),
            "count": regular_reports_by_date.get(date, 0) + drone_reports_by_date.get(date, 0)
        }
        for date in sorted(all_dates)
    ]

    # Reports by location
    reports_by_location_query = db.query(
        models.Report.location,
        func.count(models.Report.id).label('count')
    ).group_by(
        models.Report.location
    ).order_by(
        desc('count')
    ).all()

    reports_by_location = {
        location: count for location, count in reports_by_location_query
    }

    # Get categories from regular reports
    regular_categories_query = db.query(
        func.coalesce(models.Report.ai_category, 'Other').label('category'),
        func.count(models.Report.id).label('count')
    ).group_by(
        func.coalesce(models.Report.ai_category, 'Other')
    ).order_by(
        desc('count')
    ).all()

    regular_categories = {
        category: count for category, count in regular_categories_query
    }

    # Get categories from drone reports
    drone_categories_query = db.query(
        func.coalesce(models.DroneReport.category, 'Other').label('category'),
        func.count(models.DroneReport.id).label('count')
    ).group_by(
        func.coalesce(models.DroneReport.category, 'Other')
    ).order_by(
        desc('count')
    ).all()

    drone_categories = {
        category: count for category, count in drone_categories_query
    }

    # Combine categories and take top 5 + Others
    combined_categories = {}
    for category, count in regular_categories.items():
        combined_categories[category] = count

    for category, count in drone_categories.items():
        if category in combined_categories:
            combined_categories[category] += count
        else:
            combined_categories[category] = count

    # Sort categories by count
    sorted_categories = sorted(combined_categories.items(), key=lambda x: x[1], reverse=True)

    # Create a proper category mapping, ensuring 'Other' is properly handled
    cleaned_categories = {}
    other_total = 0

    # First, properly normalize category names and combine any variations of 'other'
    for category, count in sorted_categories:
        # Check if category is any variation of 'other'
        if category is None or (isinstance(category, str) and category.lower() in ['other', 'others', 'uncategorized', 'unspecified', 'unknown', 'none', '']):
            other_total += count
        else:
            # Normalize category name (capitalize first letter)
            clean_category = str(category).lower()
            clean_category = clean_category.replace('_', ' ')
            clean_category = clean_category.title()

            if clean_category in cleaned_categories:
                cleaned_categories[clean_category] += count
            else:
                cleaned_categories[clean_category] = count

    # Sort the cleaned categories
    sorted_clean_categories = sorted(cleaned_categories.items(), key=lambda x: x[1], reverse=True)

    # Take top 7 (excluding 'Other') and combine the rest as "Other"
    top_categories = dict(sorted_clean_categories[:7])

    # Add what remains from the top 7+ to the other_total
    remaining_count = sum(count for _, count in sorted_clean_categories[7:]) if len(sorted_clean_categories) > 7 else 0
    other_total += remaining_count

    # Only add "Other" category if there are actual items in it
    if other_total > 0:
        top_categories["Other"] = other_total

    # Reports by status
    reports_by_status_query = db.query(
        models.Report.status,
        func.count(models.Report.id).label('count')
    ).group_by(
        models.Report.status
    ).all()

    reports_by_status = {
        status: count for status, count in reports_by_status_query
    }

    # Return enhanced statistics
    return {
        "totalReports": total_reports,
        "regularReports": regular_total,
        "droneReports": drone_total,
        "reportsToday": reports_today,
        "resolvedReports": resolved_reports,
        "uniqueLocations": unique_locations,
        "reportsByDate": combined_reports_by_date,
        "reportsByLocation": reports_by_location,
        "reportsByStatus": reports_by_status,
        "reportsByCategory": top_categories
    }