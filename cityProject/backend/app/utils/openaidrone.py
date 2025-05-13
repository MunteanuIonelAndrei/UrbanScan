import base64
import json
import os
import httpx
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
from openai import OpenAI
from app.core.config import settings
import logging
from threading import Lock

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create OpenAI client with default httpx client that doesn't use proxy settings
http_client = httpx.Client(trust_env=False)
client = OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)

# Default prompt templates for each frame type
DEFAULT_REGULAR_PROMPT = """
Analyze this drone image for ANY issues that affect the city or its residents. Be comprehensive and inclusive in your analysis.

Focus on identifying:
1. Infrastructure damage (roads, bridges, buildings, utilities)
2. Traffic issues (accidents, congestion, improperly parked vehicles, traffic violations)
3. Safety hazards (fallen trees, debris, flooding, broken fences)
4. Environmental concerns (pollution, waste dumping, water contamination)
5. Wildlife in urban areas (potentially dangerous animals, infestations)
6. Public spaces issues (damage to parks, public facilities)
7. Suspicious activities or security concerns
8. Construction hazards or unsafe practices
9. Trees or branches interfering with power lines
10. Any other potential problems visible from aerial perspective

Respond with a detailed analysis in JSON format with the following structure:
{
    "has_issue": true/false,
    "category": "category of the issue (infrastructure, traffic, safety, environmental, wildlife, security, etc.)",
    "severity": "critical/high/medium/low. If has_issue is false, set severity to low",
    "description": "detailed description of what you observe",
    "location": "description of the location if identifiable",
    "recommendations": "suggested actions to address the issue"
}

IMPORTANT: The "has_issue" field should be true if there is ANY problem visible that requires city attention or intervention. Normal, well-functioning city scenes without issues should return has_issue: false.

DO NOT mark ordinary, expected city features as issues (such as normal traffic flow, routine construction with proper safety measures, or properly parked vehicles). Only flag genuine problems or hazards that require attention.
"""

DEFAULT_THERMAL_PROMPT = """
Analyze this thermal drone image for ANY anomalies or issues that might indicate problems requiring city attention. Be thorough in your thermal analysis.

Focus on identifying:
1. Fire hazards (unusual heat signatures in buildings, hot spots in vegetation)
2. Energy inefficiencies (excessive heat loss from buildings or infrastructure)
3. Electrical issues (hot spots in power lines, transformers, or electrical equipment)
4. Water-related problems (leaks in underground pipes, heating systems, or flooding)
5. Heat signatures of people or animals that may need assistance (stranded, lost, or in danger)
6. Environmental concerns (illegal dumping of heated materials, thermal pollution in water)
7. Vehicle anomalies (overheating engines, suspicious vehicle activity)
8. Industrial facility issues (abnormal heat signatures from equipment)
9. Heat signatures indicating active criminal activity
10. Any other thermal anomalies that could represent a safety or infrastructure issue

Respond with a detailed analysis in JSON format with the following structure:
{
    "has_issue": true/false,
    "category": "category of the issue (fire_risk, energy_loss, electrical_fault, water_leak, person_detection, environmental, vehicle, industrial, security, etc.)",
    "severity": "critical/high/medium/low. If has_issue is false, set severity to low",
    "description": "detailed description of what you observe in the thermal image",
    "location": "description of the location if identifiable",
    "recommendations": "suggested actions to address the issue"
}

IMPORTANT: The "has_issue" field should be true if there is ANY abnormal or concerning thermal pattern that requires attention or intervention.

Heat patterns that are expected and normal (such as routine heat from properly functioning equipment, normal building heat signatures in cold weather, or ordinary vehicle engines at normal temperatures) should NOT be flagged as issues. Only mark genuinely abnormal or problematic thermal signatures as issues.
"""

DEFAULT_BOTH_PROMPT = """
Analyze both the regular and thermal drone images together to identify ANY issues affecting the city or its residents. This dual-image analysis provides a uniquely comprehensive view of potential problems.

The regular image shows the visible spectrum view, while the thermal image shows heat signatures.
Combining these two data sources allows for detection of issues that might be missed with either image alone.

Focus on identifying:
1. Infrastructure problems visible in regular images with thermal confirmation (e.g., structural weaknesses showing heat pattern differences)
2. Heat anomalies in thermal images with context from the regular image (e.g., electrical hotspots, energy inefficiencies)
3. Traffic issues (accidents, congestion, improperly parked vehicles) with thermal signatures
4. Hidden water leaks or moisture problems visible only in thermal but contextually understandable in regular imagery
5. Wildlife or persons requiring assistance (using thermal to detect living beings not easily visible in regular imagery)
6. Fire hazards or hotspots with visual context
7. Environmental issues visible in either spectrum (pollution, dumping, contamination)
8. Suspicious activities or security concerns with thermal confirmation
9. Discrepancies between the two images that might indicate concealed problems
10. Building or utility problems that show both visual symptoms and thermal anomalies

Respond with a detailed analysis in JSON format with the following structure:
{
    "has_issue": true/false,
    "category": "category of the issue (infrastructure, fire_risk, electrical_fault, water_leak, traffic, wildlife, safety, environmental, security, etc.)",
    "severity": "critical/high/medium/low. If has_issue is false, set severity to low",
    "description": "detailed description combining observations from both images",
    "visible_details": "what you observe in the regular image",
    "thermal_details": "what you observe in the thermal image",
    "location": "description of the location if identifiable",
    "recommendations": "suggested actions to address the issue"
}

IMPORTANT: The "has_issue" field should be true if there is ANY problem visible in either or both images that requires city attention or intervention. Be comprehensive - issues could be infrastructural, environmental, safety-related, traffic-related, or involve wildlife or persons in need of assistance.

However, DO NOT flag normal city features or expected patterns as issues. For example:
- Normal traffic patterns with expected thermal signatures
- Routine heat signatures from properly functioning equipment or buildings
- Regular construction activities with appropriate safety measures
- Standard operations of city infrastructure with normal thermal patterns

Only flag genuine problems or hazards that truly require attention from city authorities.
"""

# Global variables for in-memory settings
_drone_ai_enabled = False
_drone_frame_type = "regular"  # Can be "regular", "thermal", or "both"
_regular_prompt = ""
_thermal_prompt = ""
_both_prompt = ""
_settings_lock = Lock()

def get_db_session():
    """
    Get a database session for settings operations
    """
    from app.db.session import SessionLocal
    return SessionLocal()

def get_db_setting(db, key, default_value=None):
    """
    Get a setting value from the database
    """
    from app.models.drone_setting import DroneAISetting
    setting = db.query(DroneAISetting).filter(DroneAISetting.key == key).first()
    if setting and setting.value:
        return setting.value
    return default_value

def update_settings(enabled: bool, frame_type: str,
                   regular_prompt: str = None, thermal_prompt: str = None, both_prompt: str = None):
    """
    Update the settings in the database AND in memory
    """
    db = get_db_session()
    try:
        from app.models.drone_setting import DroneAISetting
        
        # Update enabled status
        enabled_setting = db.query(DroneAISetting).filter(DroneAISetting.key == "drone_ai_enabled").first()
        if not enabled_setting:
            enabled_setting = DroneAISetting(
                key="drone_ai_enabled",
                value=str(enabled).lower(),
                description="Enable or disable drone AI analysis"
            )
            db.add(enabled_setting)
        else:
            enabled_setting.value = str(enabled).lower()

        # Update frame type
        frame_type_setting = db.query(DroneAISetting).filter(DroneAISetting.key == "drone_frame_type").first()
        if not frame_type_setting:
            frame_type_setting = DroneAISetting(
                key="drone_frame_type",
                value=frame_type,
                description="Type of frames to analyze (regular, thermal, or both)"
            )
            db.add(frame_type_setting)
        else:
            frame_type_setting.value = frame_type

        # Update prompts if provided
        if regular_prompt is not None:
            regular_prompt_setting = db.query(DroneAISetting).filter(DroneAISetting.key == "drone_regular_prompt").first()
            if not regular_prompt_setting:
                regular_prompt_setting = DroneAISetting(
                    key="drone_regular_prompt",
                    value=regular_prompt,
                    description="Prompt for analyzing regular drone frames"
                )
                db.add(regular_prompt_setting)
            else:
                regular_prompt_setting.value = regular_prompt

        if thermal_prompt is not None:
            thermal_prompt_setting = db.query(DroneAISetting).filter(DroneAISetting.key == "drone_thermal_prompt").first()
            if not thermal_prompt_setting:
                thermal_prompt_setting = DroneAISetting(
                    key="drone_thermal_prompt",
                    value=thermal_prompt,
                    description="Prompt for analyzing thermal drone frames"
                )
                db.add(thermal_prompt_setting)
            else:
                thermal_prompt_setting.value = thermal_prompt

        if both_prompt is not None:
            both_prompt_setting = db.query(DroneAISetting).filter(DroneAISetting.key == "drone_both_prompt").first()
            if not both_prompt_setting:
                both_prompt_setting = DroneAISetting(
                    key="drone_both_prompt",
                    value=both_prompt,
                    description="Prompt for analyzing both types of drone frames"
                )
                db.add(both_prompt_setting)
            else:
                both_prompt_setting.value = both_prompt

        # Commit changes to the database
        db.commit()
        
        # Update in-memory settings after DB update succeeds
        with _settings_lock:
            global _drone_ai_enabled, _drone_frame_type, _regular_prompt, _thermal_prompt, _both_prompt
            _drone_ai_enabled = enabled
            _drone_frame_type = frame_type
            if regular_prompt is not None:
                _regular_prompt = regular_prompt
            if thermal_prompt is not None:
                _thermal_prompt = thermal_prompt
            if both_prompt is not None:
                _both_prompt = both_prompt
                
        logger.info(f"Drone AI settings updated: enabled={enabled}, frame_type={frame_type}")
        print(f"[DRONE AI] Settings updated: enabled={enabled}, frame_type={frame_type}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating drone AI settings: {str(e)}")
        print(f"[DRONE AI ERROR] Failed to update settings: {str(e)}")
    finally:
        db.close()

def get_current_settings():
    """
    Get the current drone AI analysis settings from in-memory cache
    """
    with _settings_lock:
        return {
            "enabled": _drone_ai_enabled,
            "frame_type": _drone_frame_type,
            "regular_prompt": _regular_prompt or DEFAULT_REGULAR_PROMPT,
            "thermal_prompt": _thermal_prompt or DEFAULT_THERMAL_PROMPT,
            "both_prompt": _both_prompt or DEFAULT_BOTH_PROMPT
        }

def initialize_from_db(db_session):
    """
    Initialize settings from database values to in-memory cache
    Called at application startup and after admin refreshes settings
    """
    from app.models.drone_setting import DroneAISetting
    
    try:
        # Get enabled status
        enabled_setting = db_session.query(DroneAISetting).filter(DroneAISetting.key == "drone_ai_enabled").first()
        
        # Get frame type
        frame_type_setting = db_session.query(DroneAISetting).filter(DroneAISetting.key == "drone_frame_type").first()
        
        # Get prompts
        regular_prompt_setting = db_session.query(DroneAISetting).filter(DroneAISetting.key == "drone_regular_prompt").first()
        thermal_prompt_setting = db_session.query(DroneAISetting).filter(DroneAISetting.key == "drone_thermal_prompt").first()
        both_prompt_setting = db_session.query(DroneAISetting).filter(DroneAISetting.key == "drone_both_prompt").first()
        
        # Update in-memory cache with values from DB
        with _settings_lock:
            global _drone_ai_enabled, _drone_frame_type, _regular_prompt, _thermal_prompt, _both_prompt
            
            if enabled_setting:
                _drone_ai_enabled = enabled_setting.value.lower() == "true"
            
            if frame_type_setting:
                _drone_frame_type = frame_type_setting.value
            
            if regular_prompt_setting and regular_prompt_setting.value:
                _regular_prompt = regular_prompt_setting.value
            
            if thermal_prompt_setting and thermal_prompt_setting.value:
                _thermal_prompt = thermal_prompt_setting.value
                
            if both_prompt_setting and both_prompt_setting.value:
                _both_prompt = both_prompt_setting.value
        
        logger.info(f"Drone AI settings loaded from database: enabled={_drone_ai_enabled}, frame_type={_drone_frame_type}")
        print(f"[DRONE AI] Settings loaded from DB: enabled={_drone_ai_enabled}, frame_type={_drone_frame_type}")
        
    except Exception as e:
        logger.error(f"Error loading drone AI settings from database: {str(e)}")
        print(f"[DRONE AI ERROR] Failed to load settings: {str(e)}")
        # When error occurs, we keep using existing in-memory settings

def should_analyze_frames():
    """
    Check if frames should be analyzed based on current in-memory settings
    """
    with _settings_lock:
        return _drone_ai_enabled

def get_active_prompt():
    """
    Get the active prompt based on the current frame type from in-memory settings
    """
    with _settings_lock:
        frame_type = _drone_frame_type
        
        if frame_type == "regular":
            return _regular_prompt or DEFAULT_REGULAR_PROMPT
        elif frame_type == "thermal":
            return _thermal_prompt or DEFAULT_THERMAL_PROMPT
        elif frame_type == "both":
            return _both_prompt or DEFAULT_BOTH_PROMPT
        else:
            # Default to regular if invalid type
            return _regular_prompt or DEFAULT_REGULAR_PROMPT

async def analyze_drone_frames(
    regular_frame_b64: Optional[str] = None,
    thermal_frame_b64: Optional[str] = None,
    location: Optional[Dict[str, Any]] = None,
    timestamp: Optional[str] = None,
    drone_id: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Analyze drone frames using OpenAI's Vision API
    Returns a tuple: (should_save_report, analysis_result)
    """
    # If AI analysis is disabled, return early - use in-memory settings
    if not should_analyze_frames():
        print("[DRONE AI] Analysis disabled, skipping frame")
        return False, None
    
    print("[DRONE AI] Starting frame analysis...")
    
    # Get frame type from in-memory settings
    with _settings_lock:
        frame_type = _drone_frame_type
    
    # Check if required frames are available
    if frame_type == "regular" and not regular_frame_b64:
        print("[DRONE AI ERROR] Regular frame analysis requested but no regular frame provided")
        logger.warning("Regular frame analysis requested but no regular frame provided")
        return False, None
    
    if frame_type == "thermal" and not thermal_frame_b64:
        print("[DRONE AI ERROR] Thermal frame analysis requested but no thermal frame provided")
        logger.warning("Thermal frame analysis requested but no thermal frame provided")
        return False, None
    
    if frame_type == "both" and (not regular_frame_b64 or not thermal_frame_b64):
        print("[DRONE AI ERROR] Both frames analysis requested but not all frames provided")
        logger.warning("Both frames analysis requested but not all frames provided")
        return False, None
    
    # Get appropriate prompt - use in-memory settings
    prompt = get_active_prompt()
    
    # Add location info if available
    if location:
        location_info = f"Location coordinates: Latitude {location.get('lat')}, Longitude {location.get('lng')}"
        if location.get('alt'):
            location_info += f", Altitude {location.get('alt')} meters"
        prompt += f"\n\nDrone location: {location_info}"
    
    # Prepare system message
    system_message = {
        "role": "system", 
        "content": "You are a city monitoring AI assistant analyzing drone footage to detect urban problems, safety hazards, and infrastructure issues. You analyze images and respond in the requested JSON format."
    }
    
    # Prepare user message with images
    user_content = [{"type": "text", "text": prompt}]
    
    frame_count = 0
    # Add appropriate images based on frame type
    if frame_type == "regular" or frame_type == "both":
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{regular_frame_b64}"
            }
        })
        frame_count += 1
    
    if frame_type == "thermal" or frame_type == "both":
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{thermal_frame_b64}"
            }
        })
        frame_count += 1
    
    messages = [
        system_message,
        {"role": "user", "content": user_content}
    ]
    
    print(f"[DRONE AI] Sending {frame_count} frames to OpenAI with frame_type={frame_type}")
    
    try:
        print("[DRONE AI] Calling OpenAI Vision API...")
        # Call OpenAI Vision API
        response = client.chat.completions.create(
            model=settings.OPENAI_VISION_MODEL,
            messages=messages,
            max_tokens=1500,
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        # Extract and parse the JSON response
        json_response = response.choices[0].message.content.strip()
        analysis_result = json.loads(json_response)
        
        # Add metadata - use in-memory settings for frame type
        with _settings_lock:
            current_frame_type = _drone_frame_type
            
        analysis_result["timestamp"] = timestamp
        analysis_result["drone_id"] = drone_id
        analysis_result["frame_type"] = current_frame_type
        analysis_result["location_data"] = location
        
        # Determine if we should save this as a report
        should_save = analysis_result.get("has_issue", False)
        
        print(f"[DRONE AI] Analysis complete. Result: has_issue={should_save}")
        if should_save:
            print(f"[DRONE AI] VALID ISSUE DETECTED: Category={analysis_result.get('category')}, Severity={analysis_result.get('severity')}")
            description = analysis_result.get('description', '')
            if description:
                print(f"[DRONE AI] Description: {description[:100]}...")
        else:
            print("[DRONE AI] No issues detected, report will not be saved")
        
        logger.info(f"Drone frame analysis completed. Issue detected: {should_save}")
        
        return should_save, analysis_result
    
    except json.JSONDecodeError as e:
        print(f"[DRONE AI ERROR] Failed to parse JSON response: {str(e)}")
        logger.error(f"Error parsing JSON response: {str(e)}")
        return False, None
    
    except Exception as e:
        print(f"[DRONE AI ERROR] Call to OpenAI failed: {str(e)}")
        logger.error(f"Error calling OpenAI Vision API: {str(e)}")
        return False, None