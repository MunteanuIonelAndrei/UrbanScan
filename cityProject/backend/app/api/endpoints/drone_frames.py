import os
import time
import base64
import json
import uuid
from typing import Any, List, Optional, Dict
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Body, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.utils import openaidrone

router = APIRouter()

# In-memory storage for last 5 drone frames
drone_frames_queue = []
MAX_QUEUE_SIZE = 5

# WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

@router.post("/", status_code=status.HTTP_201_CREATED)
async def receive_drone_frames(
    *,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    payload: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    """
    Receive frames from drone ground station.
    
    Accepts:
    - regularFrame: Base64 encoded regular camera frame
    - thermalFrame: Base64 encoded thermal camera frame (optional)
    - location: Drone's GPS coordinates {lat, lng, altitude}
    - timestamp: ISO timestamp of when the frames were captured
    - droneId: Identifier for the drone
    """
    try:
        # Extract data from payload
        regular_frame = payload.get("regularFrame")
        thermal_frame = payload.get("thermalFrame")
        location = payload.get("location", {})
        timestamp = payload.get("timestamp", datetime.now().isoformat())
        drone_id = payload.get("droneId", "unknown")

        print(f"[DRONE FRAMES] Location data received: {location}")
        
        if not regular_frame:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Regular camera frame is required",
            )
        
        print(f"[DRONE FRAMES] Received frames from drone {drone_id}")
        
        # Create a unique ID for this frame set
        frame_id = f"drone_frame_{int(time.time() * 1000)}"
        
        # Process the frames (optional - save to disk if needed)
        regular_frame_path = None
        thermal_frame_path = None
        
        if settings.SAVE_DRONE_FRAMES:
            # Create directory for frames if it doesn't exist
            frames_dir = Path(settings.UPLOAD_DIR) / "drone_frames" / frame_id
            frames_dir.mkdir(parents=True, exist_ok=True)
            
            # Save regular frame
            regular_frame_path = frames_dir / "regular.jpg"
            with open(regular_frame_path, "wb") as f:
                f.write(base64.b64decode(regular_frame))
            
            # Save thermal frame if available
            if thermal_frame:
                thermal_frame_path = frames_dir / "thermal.jpg"
                with open(thermal_frame_path, "wb") as f:
                    f.write(base64.b64decode(thermal_frame))
            
            print(f"[DRONE FRAMES] Saved frames to disk: {frames_dir}")
        
        # Create frame data object
        frame_data = {
            "id": frame_id,
            "timestamp": timestamp,
            "droneId": drone_id,
            "location": location,
            "hasRegularFrame": bool(regular_frame),
            "hasThermalFrame": bool(thermal_frame),
            "regularFramePath": str(regular_frame_path) if regular_frame_path else None,
            "thermalFramePath": str(thermal_frame_path) if thermal_frame_path else None,
            # Include base64 frames for immediate use
            "regularFrame": regular_frame,
            "thermalFrame": thermal_frame
        }
        
        # Add to queue (FIFO)
        global drone_frames_queue
        drone_frames_queue.append(frame_data)
        
        # Maintain maximum queue size
        if len(drone_frames_queue) > MAX_QUEUE_SIZE:
            drone_frames_queue = drone_frames_queue[-MAX_QUEUE_SIZE:]
        
        # Schedule AI analysis in background if enabled - use in-memory settings
        # should_analyze_frames() uses in-memory settings and doesn't need db_session
        if openaidrone.should_analyze_frames():
            print(f"[DRONE FRAMES] Scheduling AI analysis for frame {frame_id}")
            background_tasks.add_task(
                process_drone_frames_for_ai,
                db,
                regular_frame,
                thermal_frame,
                location,
                timestamp,
                drone_id,
                frame_id
            )
        else:
            print("[DRONE FRAMES] AI analysis is disabled - skipping analysis")
        
        # Notify connected WebSocket clients
        await notify_clients(frame_data)
        
        return {
            "success": True,
            "message": "Frames received successfully",
            "frameId": frame_id
        }
    
    except Exception as e:
        print(f"[DRONE FRAMES ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing drone frames: {str(e)}",
        )

@router.get("/latest", response_model=List[Dict[str, Any]])
def get_latest_drone_frames(
    db: Session = Depends(deps.get_db),
    current_user: Optional[models.User] = Depends(deps.get_optional_current_user),
) -> Any:
    """
    Get the latest drone frames.
    Returns the last 5 frame sets received from drones.
    """
    return drone_frames_queue

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time drone frame updates"""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Send current queue state on connection
        if drone_frames_queue:
            await websocket.send_json({
                "type": "init",
                "frames": drone_frames_queue
            })

        # Keep connection open
        while True:
            # Wait for messages or close
            data = await websocket.receive_text()
            try:
                # Parse message if it's JSON
                message = json.loads(data)

                # Handle ping/pong for heartbeat
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception as e:
                # If not JSON or other error, ignore
                pass

    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        if websocket in active_connections:
            active_connections.remove(websocket)

async def notify_clients(frame_data: Dict[str, Any]):
    """Notify all connected WebSocket clients of new frame data"""
    if not active_connections:
        return

    message = {
        "type": "new_frame",
        "frame": frame_data
    }

    # Make a copy of the list to avoid modification during iteration
    connections_to_remove = []

    for connection in active_connections:
        try:
            await connection.send_json(message)
        except Exception as e:
            print(f"Error sending message to client: {str(e)}")
            connections_to_remove.append(connection)

    # Remove failed connections
    for connection in connections_to_remove:
        if connection in active_connections:
            active_connections.remove(connection)

async def process_drone_frames_for_ai(
    db: Session,
    regular_frame: str,
    thermal_frame: Optional[str],
    location: Dict[str, Any],
    timestamp: str,
    drone_id: str,
    frame_id: str
):
    """
    Process drone frames for AI analysis and save report if needed
    """
    try:
        print(f"[DRONE PROCESS] Starting AI analysis for frame {frame_id}")

        # Analyze the frames using OpenAI
        should_save, analysis_result = await openaidrone.analyze_drone_frames(
            regular_frame_b64=regular_frame,
            thermal_frame_b64=thermal_frame,
            location=location,
            timestamp=timestamp,
            drone_id=drone_id
        )

        # If no issue detected or analysis failed, we can skip saving the report
        if not should_save or analysis_result is None:
            print(f"[DRONE PROCESS] No issue detected or analysis failed for frame {frame_id}")
            return

        print(f"[DRONE PROCESS] Issue detected! Creating report for frame {frame_id}")

        # Create a drone report if the AI detected an issue
        report = models.DroneReport(
            report_id=frame_id,
            timestamp=datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else timestamp,
            drone_id=drone_id,
            frame_type=analysis_result.get('frame_type', 'regular'),

            # Location
            latitude=location.get('lat', 0.0),
            longitude=location.get('lng', 0.0),
            altitude=location.get('alt', 0.0),
            location_description=f"Drone position at {location.get('lat', 0.0)}, {location.get('lng', 0.0)} at altitude {location.get('alt', 0.0)}m",

            # Analysis data
            category=analysis_result.get('category'),
            severity=analysis_result.get('severity'),
            description=analysis_result.get('description'),
            visible_details=analysis_result.get('visible_details'),
            thermal_details=analysis_result.get('thermal_details'),
            recommendations=analysis_result.get('recommendations'),

            # Raw data
            analysis_data=analysis_result,

            # Status
            status="new",
            has_been_viewed=False
        )

        db.add(report)
        db.flush()  # Get the report ID

        print(f"[DRONE PROCESS] Created report with DB ID {report.id}")

        # Create photo entries if we saved the files
        frames_dir = Path(settings.UPLOAD_DIR) / "drone_frames" / frame_id
        photo_paths = []

        # Regular frame photo
        regular_file_path = frames_dir / "regular.jpg"
        if regular_file_path.exists():
            regular_photo = models.DroneReportPhoto(
                report_id=report.id,
                filename="regular.jpg",
                file_path=f"drone_frames/{frame_id}/regular.jpg",
                file_size=os.path.getsize(regular_file_path),
                mime_type="image/jpeg",
                photo_type="regular"
            )
            db.add(regular_photo)
            photo_paths.append(str(regular_file_path))
            print(f"[DRONE PROCESS] Added regular photo to report")

        # Thermal frame photo if available
        thermal_file_path = frames_dir / "thermal.jpg"
        if thermal_file_path.exists():
            thermal_photo = models.DroneReportPhoto(
                report_id=report.id,
                filename="thermal.jpg",
                file_path=f"drone_frames/{frame_id}/thermal.jpg",
                file_size=os.path.getsize(thermal_file_path),
                mime_type="image/jpeg",
                photo_type="thermal"
            )
            db.add(thermal_photo)
            photo_paths.append(str(thermal_file_path))
            print(f"[DRONE PROCESS] Added thermal photo to report")

        # Commit the transaction
        db.commit()

        print(f"[DRONE PROCESS] SUCCESS! Created drone report {frame_id} with category '{analysis_result.get('category')}' and severity '{analysis_result.get('severity')}'")

        # Send Telegram notification for critical reports
        severity = analysis_result.get("severity", "").lower()
        if (settings.TELEGRAM_NOTIFICATIONS_ENABLED and
            severity in settings.TELEGRAM_NOTIFY_SEVERITY):
            try:
                from app.utils.telegram import telegram_notifier

                # Prepare description content
                description = analysis_result.get("description", "No description available")

                # Add frame-specific details if available
                if analysis_result.get("visible_details"):
                    description += f"\n\nRegular image: {analysis_result.get('visible_details')}"

                if analysis_result.get("thermal_details"):
                    description += f"\n\nThermal image: {analysis_result.get('thermal_details')}"

                # Prepare location info
                location_text = f"Drone position at {location.get('lat', 0.0)}, {location.get('lng', 0.0)}"
                if location.get('alt'):
                    location_text += f" at altitude {location.get('alt', 0.0)}m"

                # Send notification
                await telegram_notifier.send_critical_report_notification(
                    report_type="drone",
                    report_id=frame_id,
                    severity=severity,
                    category=analysis_result.get('category', 'Unknown'),
                    description=description,
                    recommendations=analysis_result.get('recommendations', 'No recommendations available'),
                    photo_paths=photo_paths,
                    latitude=location.get('lat'),
                    longitude=location.get('lng'),
                    location=location_text
                )
                print(f"[DRONE PROCESS] Telegram notification sent for critical drone report {frame_id}")
            except Exception as telegram_err:
                print(f"[DRONE PROCESS] Error sending Telegram notification: {str(telegram_err)}")

    except Exception as e:
        print(f"[DRONE PROCESS ERROR] Failed to process frames for AI: {str(e)}")
        db.rollback()