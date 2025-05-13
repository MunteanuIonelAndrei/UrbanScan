#!/usr/bin/env python3
"""
utils.py
---------
Utility functions shared across the drone control system
"""

import io
import os
import time
import random
import string

def is_raspberrypi():
    """Check if the code is running on a Raspberry Pi."""
    try:
        with io.open('/sys/firmware/devicetree/base/model', 'r') as m:
            if 'raspberry pi' in m.read().lower():
                return True
    except Exception:
        pass
    return False

def generate_timestamp():
    """Generate a formatted timestamp for file naming."""
    return time.strftime("%Y%m%d_%H%M%S")

def get_writable_directory(preferred_dirs=None):
    """
    Find a writable directory for saving files
    
    Args:
        preferred_dirs (list): List of directories to try in order
        
    Returns:
        str: Path to a writable directory or None if none found
    """
    if preferred_dirs is None:
        preferred_dirs = [
            '/home/andre/Documents/env/cityDrone/drone_captures',
            os.path.expanduser('~/drone_captures'),  # User's home directory
            '/tmp/drone_captures',                   # /tmp should be writable
            '.'                                      # Current directory as last resort
        ]
    
    for dir_path in preferred_dirs:
        try:
            # Create the directory if it doesn't exist
            if not os.path.exists(dir_path):
                os.makedirs(dir_path, exist_ok=True)
            
            # Test if directory is writable by creating a test file
            test_file = os.path.join(dir_path, '.write_test')
            with open(test_file, 'w') as f:
                f.write('test')
            os.remove(test_file)
            
            return dir_path
        except Exception:
            continue
    
    return None

def get_device_serial():
    """Get the Raspberry Pi serial number if available"""
    try:
        # Try to get serial from /proc/cpuinfo
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if line.startswith('Serial'):
                    return line.split(':')[1].strip()
    except Exception:
        pass
    
    # Return a random ID if we can't get the serial
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def get_available_video_devices():
    """
    Find available video devices on the system
    
    Returns:
        list: List of available video device indices
    """
    available_devices = []
    
    # Try to find video devices
    for i in range(10):  # Try devices 0-9
        try:
            import cv2
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                available_devices.append(i)
                cap.release()
        except Exception:
            pass
    
    return available_devices

def clamp(value, min_value, max_value):
    """Clamp a value between minimum and maximum values"""
    return max(min_value, min(max_value, value))

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the distance between two GPS coordinates
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        
    Returns:
        float: Distance in meters
    """
    import math
    
    # Earth radius in meters
    R = 6371000
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

def calculate_bearing(lat1, lon1, lat2, lon2):
    """
    Calculate the bearing (heading) from point 1 to point 2
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        
    Returns:
        float: Bearing in degrees (0-360)
    """
    import math
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Calculate bearing
    y = math.sin(lon2_rad - lon1_rad) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - \
        math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(lon2_rad - lon1_rad)
    bearing_rad = math.atan2(y, x)
    
    # Convert to degrees
    bearing_deg = math.degrees(bearing_rad)
    
    # Normalize to 0-360
    bearing_deg = (bearing_deg + 360) % 360
    
    return bearing_deg