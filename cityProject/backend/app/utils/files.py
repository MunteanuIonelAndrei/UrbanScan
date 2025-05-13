import os
import shutil
from typing import Any, List
from pathlib import Path
from fastapi import UploadFile


async def save_upload_file(upload_file: UploadFile, destination: Path) -> Path:
    """
    Save an upload file to the specified destination.
    
    Args:
        upload_file: The uploaded file
        destination: The destination path
        
    Returns:
        Path: The saved file path
    """
    try:
        # Create destination directory if it doesn't exist
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        
        # Copy file to destination
        with open(destination, "wb") as buffer:
            # Read file in chunks to handle large files
            shutil.copyfileobj(upload_file.file, buffer)
    finally:
        # Reset file position after reading
        upload_file.file.seek(0)
    
    return destination


def remove_file(file_path: Path) -> bool:
    """
    Remove a file if it exists.
    
    Args:
        file_path: The path to the file to remove
        
    Returns:
        bool: True if the file was removed, False otherwise
    """
    try:
        if file_path.exists():
            os.remove(file_path)
            return True
        return False
    except Exception as e:
        print(f"Error removing file {file_path}: {str(e)}")
        return False