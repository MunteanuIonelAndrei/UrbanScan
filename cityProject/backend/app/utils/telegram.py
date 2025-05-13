import os
import httpx
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramNotifier:
    """
    Utility class for sending notifications to Telegram
    """
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.chat_id = settings.TELEGRAM_CHAT_ID
        self.api_base_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.enabled = settings.TELEGRAM_NOTIFICATIONS_ENABLED
        
        # Validate configuration
        if self.enabled and (not self.bot_token or not self.chat_id):
            logger.warning("Telegram notifications are enabled but missing bot_token or chat_id")
            self.enabled = False
    
    async def send_message(self, text: str) -> Dict[str, Any]:
        """
        Send a text message to the Telegram chat
        """
        if not self.enabled:
            logger.info("Telegram notifications are disabled")
            return {"success": False, "reason": "Notifications disabled"}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": text,
                        "parse_mode": "HTML"
                    }
                )
                result = response.json()
                
                if not result.get("ok"):
                    logger.error(f"Telegram API error: {result.get('description')}")
                    return {"success": False, "error": result.get('description')}
                
                return {"success": True, "message_id": result.get("result", {}).get("message_id")}
        
        except Exception as e:
            logger.error(f"Error sending Telegram message: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_photo(self, photo_path: str, caption: Optional[str] = None) -> Dict[str, Any]:
        """
        Send a photo to the Telegram chat
        """
        if not self.enabled:
            logger.info("Telegram notifications are disabled")
            return {"success": False, "reason": "Notifications disabled"}
        
        try:
            # Verify file exists
            if not os.path.exists(photo_path):
                logger.error(f"Photo file not found: {photo_path}")
                return {"success": False, "error": "File not found"}
            
            # Prepare the data for multipart upload
            data = {"chat_id": self.chat_id}
            if caption:
                data["caption"] = caption
                data["parse_mode"] = "HTML"
            
            files = {"photo": open(photo_path, "rb")}
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/sendPhoto",
                    data=data,
                    files=files,
                )
                result = response.json()
                
                if not result.get("ok"):
                    logger.error(f"Telegram API error: {result.get('description')}")
                    return {"success": False, "error": result.get('description')}
                
                return {"success": True, "message_id": result.get("result", {}).get("message_id")}
        
        except Exception as e:
            logger.error(f"Error sending Telegram photo: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            # Close file if it was opened
            if 'files' in locals() and 'photo' in files:
                files['photo'].close()
    
    async def send_multiple_photos(self, 
                                photo_paths: List[str], 
                                main_caption: Optional[str] = None) -> Dict[str, Any]:
        """
        Send multiple photos as a media group to the Telegram chat
        """
        if not self.enabled:
            logger.info("Telegram notifications are disabled")
            return {"success": False, "reason": "Notifications disabled"}
        
        if not photo_paths:
            logger.warning("No photos provided for sending")
            return {"success": False, "error": "No photos provided"}
        
        try:
            # Verify files exist
            for path in photo_paths:
                if not os.path.exists(path):
                    logger.error(f"Photo file not found: {path}")
                    return {"success": False, "error": f"File not found: {path}"}
            
            # If there's only one photo, use the regular send_photo method
            if len(photo_paths) == 1:
                return await self.send_photo(photo_paths[0], main_caption)
            
            # For multiple photos, we need to use sendMediaGroup
            media = []
            
            # First photo gets the caption
            media.append({
                "type": "photo",
                "media": f"attach://photo0",
                "caption": main_caption,
                "parse_mode": "HTML"
            })
            
            # Add the rest of the photos
            for i in range(1, len(photo_paths)):
                media.append({
                    "type": "photo",
                    "media": f"attach://photo{i}"
                })
            
            # Prepare files for multipart upload
            files = {}
            for i, path in enumerate(photo_paths):
                files[f"photo{i}"] = open(path, "rb")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/sendMediaGroup",
                    data={"chat_id": self.chat_id, "media": str(media)},
                    files=files,
                )
                result = response.json()
                
                if not result.get("ok"):
                    logger.error(f"Telegram API error: {result.get('description')}")
                    return {"success": False, "error": result.get('description')}
                
                return {"success": True, "message_ids": [msg.get("message_id") for msg in result.get("result", [])]}
        
        except Exception as e:
            logger.error(f"Error sending Telegram media group: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            # Close all opened files
            if 'files' in locals():
                for f in files.values():
                    f.close()
    
    def create_google_maps_link(self, latitude: float, longitude: float) -> str:
        """
        Create a Google Maps link from coordinates
        """
        if not latitude or not longitude:
            return ""
        
        return f"https://www.google.com/maps?q={latitude},{longitude}"
    
    async def send_critical_report_notification(self,
                                             report_type: str,
                                             report_id: str,
                                             severity: str,
                                             category: str,
                                             description: str,
                                             recommendations: str,
                                             photo_paths: List[str],
                                             latitude: Optional[float] = None,
                                             longitude: Optional[float] = None,
                                             location: Optional[str] = None) -> Dict[str, Any]:
        """
        Send a notification for a report with all relevant information and photos
        """
        if not self.enabled:
            logger.info("Telegram notifications are disabled")
            return {"success": False, "reason": "Notifications disabled"}

        # Create message
        maps_link = self.create_google_maps_link(latitude, longitude) if latitude and longitude else ""
        location_info = f"{location}" if location else ""

        if maps_link:
            location_info += f"\nLocation on map: {maps_link}"

        # Format severity for title (uppercase first letter)
        severity_upper = severity.upper() if severity else "UNKNOWN"

        # Select emoji based on severity
        emoji = "🚨" if severity.lower() == "critical" else "⚠️" if severity.lower() == "high" else "ℹ️"

        message = f"""
{emoji} <b>{severity_upper} {report_type.upper()} REPORT</b> {emoji}

<b>Report ID:</b> {report_id}
<b>Severity:</b> {severity}
<b>Category:</b> {category}

<b>Description:</b>
{description}

<b>Recommendations:</b>
{recommendations}

<b>Location:</b>
{location_info}
"""
        
        # Send message with photos
        if photo_paths:
            return await self.send_multiple_photos(photo_paths, message)
        else:
            return await self.send_message(message)

# Create a global instance for easy importing
telegram_notifier = TelegramNotifier()