import base64
import json
import os
import httpx
from typing import Optional, List, Dict, Any
from pathlib import Path
from openai import OpenAI
from app.core.config import settings

# Create OpenAI client with default httpx client that doesn't use proxy settings
http_client = httpx.Client(trust_env=False)
client = OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)

def encode_image_to_base64(image_path: str) -> str:
    """
    Encode an image file to base64 string
    """
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

async def analyze_report_with_vision(
    problem_details: str,
    location: str,
    photo_paths: List[str],
    latitude: Optional[float] = None,
    longitude: Optional[float] = None
) -> Dict[str, Any]:
    """
    Analyze a report using OpenAI's Vision API to analyze images and provide structured assessment
    """
    # Prepare location info
    location_info = f"Location: {location}"
    if latitude and longitude:
        location_info += f" (Coordinates: {latitude}, {longitude})"
    
    # Use the custom prompt from settings if available, otherwise use default
    if settings.VISION_PROMPT:
        # Use the custom prompt from settings and insert the problem details and location
        prompt = f"""
        {settings.VISION_PROMPT}
        
        Problem Description: {problem_details}
        {location_info}
        
        IMPORTANT: Evaluate if this is a valid city problem report. A valid report contains ANY issue that affects the city or its residents, including but not limited to:
        - Infrastructure problems (damaged roads, broken utilities, etc.)
        - Traffic issues (accidents, congestion, improperly parked vehicles)
        - Environmental concerns (garbage, pollution, fallen trees)
        - Wildlife in urban areas (potentially dangerous animals, infestations)
        - Public safety hazards (broken fences, poor lighting, suspicious activities)
        - Quality of life issues (noise pollution, graffiti, vandalism)
        - Public health concerns (standing water, potential disease vectors)

        Invalid reports include only:
        - Personal indoor items with no city relevance
        - Joke submissions or memes
        - Deliberately misleading images (e.g., wallpapers of animals, fake scenes)
        - Random objects with no connection to city problems
        
        Return your analysis as a JSON object with the following structure:
        
        {{
            "category": "The category of the city problem",
            "severity": "One of 'critical', 'high', 'medium', or 'low'. If this is not a valid report (is_valid_report is false), set severity to 'low'.",
            "department": "The city department likely responsible",
            "impact": "Brief assessment of potential impact",
            "is_valid_report": true/false,
            "invalid_reason": "If is_valid_report is false, explain why this isn't a valid city problem report. Empty string if valid.",
            "estimated_fix_time": "Estimated time to fix",
            "recommendations": "Brief recommendations"
        }}
        
        IMPORTANT: The is_valid_report field should be:
        - true: For ANY genuine city issue shown in photos or described clearly - be inclusive rather than restrictive
        - false: ONLY for clearly fake images, joke submissions, personal indoor items, or content completely unrelated to any city issue
        
        IMPORTANT: Respond with ONLY the JSON object and nothing else. Your response must be valid JSON.
        """
    else:
        # Use the default prompt
        prompt = f"""
        Analyze the following city problem report based on the images and description provided:
        
        Problem Description: {problem_details}
        {location_info}
        
        Use the images to carefully assess the situation and provide a comprehensive analysis. 
        
        IMPORTANT: Evaluate if this is a valid city problem report. A valid report contains ANY issue that affects the city or its residents, including but not limited to:
        - Infrastructure problems (damaged roads, broken utilities, etc.)
        - Traffic issues (accidents, congestion, improperly parked vehicles)
        - Environmental concerns (garbage, pollution, fallen trees)
        - Wildlife in urban areas (potentially dangerous animals, infestations)
        - Public safety hazards (broken fences, poor lighting, suspicious activities)
        - Quality of life issues (noise pollution, graffiti, vandalism)
        - Public health concerns (standing water, potential disease vectors)

        Invalid reports include only:
        - Personal indoor items with no city relevance
        - Joke submissions or memes
        - Deliberately misleading images (e.g., wallpapers of animals, fake scenes)
        - Random objects with no connection to city problems

        Return your analysis as a JSON object with the following structure:
        
        {{
            "category": "The category of the city problem (e.g., 'infrastructure', 'public safety', 'waste management', 'roads', 'utilities', 'vandalism', 'environment')",
            "severity": "One of 'critical', 'high', 'medium', or 'low'. If this is not a valid report (is_valid_report is false), set severity to 'low'.",
            "department": "The city department likely responsible for addressing this issue",
            "impact": "Brief assessment of potential impact to residents or city infrastructure",
            "is_valid_report": true/false,
            "invalid_reason": "If is_valid_report is false, explain why this isn't a valid city problem report. Empty string if valid.",
            "estimated_fix_time": "Estimated time to fix (e.g., 'hours', 'days', 'weeks')",
            "recommendations": "Brief recommendations for addressing the issue"
        }}
        
        IMPORTANT: The is_valid_report field should be:
        - true: For ANY genuine city issue shown in photos or described clearly - be inclusive rather than restrictive
        - false: ONLY for clearly fake images, joke submissions, personal indoor items, or content completely unrelated to any city issue

        Respond with ONLY the JSON object and nothing else. Your response must be valid JSON.
        """
    
    # Prepare messages for API call with images
    messages = [
        {
            "role": "system", 
            "content": "You are a city management AI assistant that helps analyze urban problems using image analysis capabilities. You provide useful structured insights for city officials."
        }
    ]
    
    # Add user content with text and images
    user_content = [{"type": "text", "text": prompt}]
    
    # Add images to the message (max 5 images to avoid token limits)
    for photo_path in photo_paths[:5]:
        try:
            if os.path.exists(photo_path):
                base64_image = encode_image_to_base64(photo_path)
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                })
        except Exception as e:
            print(f"Error encoding image {photo_path}: {str(e)}")
    
    messages.append({"role": "user", "content": user_content})
    
    try:
        # Call OpenAI Vision API
        response = client.chat.completions.create(
            model=settings.OPENAI_VISION_MODEL,
            messages=messages,
            max_tokens=1000,
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        # Extract and parse the JSON response
        json_response = response.choices[0].message.content.strip()
        return json.loads(json_response)
    
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {str(e)}")
        # Return a simple structured result in case of JSON parsing error
        return {
            "category": "unknown",
            "severity": "medium",
            "department": "city management",
            "impact": "Unable to determine impact",
            "is_valid_report": True,
            "invalid_reason": "",
            "estimated_fix_time": "unknown",
            "recommendations": "Please review this report manually."
        }
    except Exception as e:
        # Log the error and return a generic structured result
        print(f"Error calling OpenAI Vision API: {str(e)}")
        return {
            "category": "unknown",
            "severity": "medium",
            "department": "city management",
            "impact": "Unable to determine impact",
            "is_valid_report": True,
            "invalid_reason": "",
            "estimated_fix_time": "unknown",
            "recommendations": "Unable to analyze this report automatically. Please review manually."
        }

async def analyze_report_with_openai(
    problem_details: str,
    location: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    photo_paths: Optional[List[str]] = None
) -> str:
    """
    Legacy function for backwards compatibility - returns text analysis
    """
    # If photo_paths are provided and the vision model is enabled, use the vision model
    if photo_paths and settings.USE_VISION_API:
        try:
            analysis_json = await analyze_report_with_vision(
                problem_details, location, photo_paths, latitude, longitude
            )
            # Convert the structured result to a human-readable format
            result = f"""
            Category: {analysis_json.get('category', 'Unknown')}
            Severity: {analysis_json.get('severity', 'Unknown')}
            Department: {analysis_json.get('department', 'Unknown')}
            Impact: {analysis_json.get('impact', 'Unknown')}
            Valid Report: {'Yes' if analysis_json.get('is_valid_report', True) else 'No'}
            Est. Fix Time: {analysis_json.get('estimated_fix_time', 'Unknown')}
            Recommendations: {analysis_json.get('recommendations', 'None provided')}
            """
            return result
        except Exception as e:
            print(f"Error in vision analysis, falling back to text analysis: {str(e)}")
            # Fall through to text-only analysis
    
    # Fallback to text-only analysis
    # Prepare prompt
    location_info = f"Location: {location}"
    if latitude and longitude:
        location_info += f" (Coordinates: {latitude}, {longitude})"
    
    prompt = f"""
    Analyze the following city problem report:
    
    Problem Description: {problem_details}
    {location_info}
    
    Please provide:
    1. A brief assessment of the problem severity
    2. Potential impact to residents or city infrastructure
    3. What city department would likely be responsible
    4. Estimated priority level (critical, high, medium, low). If this is not a valid city problem, set severity to 'low'.
    5. Any recommendations for addressing this issue
    
    Respond with a concise summary of your analysis.
    """
    
    try:
        # Call OpenAI API
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a city management AI assistant that helps analyze urban problems and provide useful insights for city officials."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7,
        )
        
        # Extract the response text
        return response.choices[0].message.content.strip()
    except Exception as e:
        # Log the error and return a generic message
        print(f"Error calling OpenAI API: {str(e)}")
        return "Unable to analyze this report automatically. Please review manually."
