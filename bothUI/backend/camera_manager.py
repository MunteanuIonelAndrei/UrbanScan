#!/usr/bin/env python3
"""
camera_manager.py
---------
Manages camera initialization and streaming
Handles both regular and thermal cameras
"""

import cv2
import numpy as np
import time
import os
import queue
import threading
from aiortc import VideoStreamTrack
from av import VideoFrame

# Try to import Pi-specific camera libraries
try:
    from picamera2 import Picamera2
    CAMERA_AVAILABLE = True
except ImportError:
    CAMERA_AVAILABLE = False
    print("[Camera] PiCamera2 not available. Video stream may use a placeholder.")

# Import thermal camera
from thermal_camera import ThermalCamera
from utils import generate_timestamp, get_writable_directory

class GlobalCameraStreamTrack(VideoStreamTrack):
    """Video stream track for the regular camera."""
    def __init__(self, camera):
        super().__init__()
        self.camera = camera
        self.data_channel = None
        self.kind = "video"
        self.track_id = "regular"

    def set_data_channel(self, channel):
        """Set the data channel."""
        self.data_channel = channel

    async def recv(self):
        # Capture frame
        frame = self.camera.capture_array()
        # Flip if you need
        frame = cv2.flip(frame, -1)
        
        # Create video frame from numpy array
        video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
        pts, time_base = await self.next_timestamp()
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

class ThermalCameraStreamTrack(VideoStreamTrack):
    """Video stream track for the thermal camera."""
    def __init__(self, thermal_camera):
        super().__init__()
        self.thermal_camera = thermal_camera
        self.data_channel = None
        self.kind = "video"
        self.track_id = "thermal"
        self.last_frame = None  # Backup frame in case we can't get a new one
        self.error_frame = None  # Pre-rendered error frame
        self.last_frame_time = 0
        self.error_count = 0
        self.failure_count = 0  # Count of consecutive complete failures
        
        # Create a default placeholder frame
        self.default_frame = np.zeros((576, 768, 3), dtype=np.uint8)
        cv2.putText(
            self.default_frame,
            "Initializing thermal camera...",
            (50, 288),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 200, 200),
            2
        )
        
    def set_data_channel(self, channel):
        """Set the data channel."""
        self.data_channel = channel
        
    def create_error_frame(self, message="No thermal data available"):
        """Create an error frame with the given message."""
        frame = np.zeros((576, 768, 3), dtype=np.uint8)  # 3x scale of 192x256
        # Add message
        cv2.putText(
            frame, message, (50, 288),
            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2
        )
        # Add timestamp
        timestamp = time.strftime("%H:%M:%S")
        cv2.putText(
            frame, f"Time: {timestamp}", (50, 320),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1
        )
        return frame
        
    async def recv(self):
        current_time = time.time()
        
        try:
            # Check if thermal camera is actually available
            if not self.thermal_camera or not hasattr(self.thermal_camera, 'cap') or not self.thermal_camera.cap.isOpened():
                self.failure_count += 1
                if self.failure_count < 5 or self.failure_count % 30 == 0:  # Log less frequently after initial failures
                    print(f"[Camera] Thermal camera not available ({self.failure_count} failures)")
                
                if self.last_frame is not None:
                    # Use the last valid frame with a warning
                    frame = self.last_frame.copy()
                    cv2.putText(
                        frame, 
                        "CAMERA DISCONNECTED", 
                        (50, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        1, 
                        (0, 0, 255), 
                        2
                    )
                else:
                    # Use the default frame
                    frame = self.default_frame.copy()
                    cv2.putText(
                        frame, 
                        f"CAMERA UNAVAILABLE ({self.failure_count})", 
                        (50, 330),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.7, 
                        (0, 0, 255), 
                        1
                    )
                    
                # Create video frame and return early
                video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
                pts, time_base = await self.next_timestamp()
                video_frame.pts = pts
                video_frame.time_base = time_base
                return video_frame
            
            # Get the latest thermal frame
            try:
                frame_data = self.thermal_camera.get_latest_frame()
                
                if frame_data is not None:
                    # Successfully got a new frame
                    if isinstance(frame_data, tuple) and len(frame_data) == 2:
                        frame, temp_data = frame_data
                    else:
                        # Only got an image without temperature data
                        frame = frame_data
                        temp_data = {"status": "no_temp_data"}
                        
                    self.last_frame = frame  # Save this frame as backup
                    self.last_frame_time = current_time
                    self.error_count = 0
                    self.failure_count = 0  # Reset complete failure count
                elif self.last_frame is not None and current_time - self.last_frame_time < 30:
                    # Use the last valid frame if we couldn't get a new one and it's not too old
                    frame = self.last_frame.copy()  # Always copy to avoid modifying cached frame
                    self.error_count += 1
                    
                    # If we've had several errors in a row, add a warning label
                    if self.error_count > 5:
                        cv2.putText(
                            frame, 
                            f"STALE DATA - {self.error_count}s", 
                            (50, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 
                            1, 
                            (0, 0, 255), 
                            2
                        )
                else:
                    # No recent frames available
                    frame = self.create_error_frame("No thermal frames available")
            except Exception as frame_err:
                print(f"[Camera] Error getting thermal frame: {frame_err}")
                if self.last_frame is not None:
                    frame = self.last_frame.copy()
                    cv2.putText(
                        frame, 
                        "FRAME ERROR", 
                        (50, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        1, 
                        (0, 0, 255), 
                        2
                    )
                else:
                    frame = self.create_error_frame(f"Error: {str(frame_err)}")
                
        except Exception as e:
            print(f"[Camera] Critical error in thermal camera track: {e}")
            # Fall back to our default frame for any critical errors
            if self.default_frame is not None:
                frame = self.default_frame.copy()
                cv2.putText(
                    frame, 
                    f"ERROR: {str(e)}", 
                    (50, 330),
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.6, 
                    (0, 0, 255), 
                    1
                )
            else:
                # If all else fails, create a basic error frame
                frame = np.zeros((576, 768, 3), dtype=np.uint8)
                cv2.putText(
                    frame, 
                    "Critical error in thermal camera", 
                    (50, 288),
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    1, 
                    (0, 0, 255), 
                    2
                )
        
        # Create video frame from numpy array
        video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
        pts, time_base = await self.next_timestamp()
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

class VideoRecorder:
    """Handles recording video from camera sources"""
    
    def __init__(self, camera_manager):
        self.camera_manager = camera_manager
        self.recording = False
        self.stop_flag = threading.Event()
        self.recording_threads = []
        self.normal_video_writer = None
        self.thermal_video_writer = None
        self.recording_dir = None
        self.thermal_data_dir = None
        self.thermal_data_fps = 1  # Default FPS for thermal data recording
        self.timestamp = None
        self.video_fps = 30  # Default FPS for video recording
        self.frames_recorded = {
            "normal": 0,
            "thermal": 0,
            "thermal_data": 0
        }
        
    def start_recording(self, thermal_data_fps=1):
        """
        Start recording video from both cameras
        
        Args:
            thermal_data_fps: Frames per second for thermal data (.npy) recording
        """
        if self.recording:
            print("[VideoRecorder] Already recording")
            return {"error": "Already recording"}
            
        try:
            # Generate timestamp for this recording session
            self.timestamp = generate_timestamp()
            self.thermal_data_fps = max(0.1, min(30, thermal_data_fps))  # Limit FPS between 0.1 and 30
            self.frames_recorded = {"normal": 0, "thermal": 0, "thermal_data": 0}
            
            # Get a writable directory
            base_dir = get_writable_directory()
            if not base_dir:
                return {"error": "No writable directory found for recording"}
                
            # Create recording directory structure
            self.recording_dir = os.path.join(base_dir, f"video_{self.timestamp}")
            os.makedirs(self.recording_dir, exist_ok=True)
            
            # Create thermal data directory
            self.thermal_data_dir = os.path.join(self.recording_dir, "thermal_data")
            os.makedirs(self.thermal_data_dir, exist_ok=True)
            
            # Reset the stop flag
            self.stop_flag.clear()
            
            # Create video writers for both cameras
            if self.camera_manager.is_camera_available():
                # Get a test frame to determine size
                test_frame = self.camera_manager.capture_normal_frame()
                if test_frame is not None:
                    h, w = test_frame.shape[:2]
                    normal_video_path = os.path.join(self.recording_dir, f"normal_{self.timestamp}.mp4")
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                    self.normal_video_writer = cv2.VideoWriter(normal_video_path, fourcc, self.video_fps, (w, h))
                    
                    # Start normal camera recording thread
                    normal_thread = threading.Thread(
                        target=self._record_normal_video,
                        daemon=True
                    )
                    normal_thread.start()
                    self.recording_threads.append(normal_thread)
                    print(f"[VideoRecorder] Started normal camera recording to {normal_video_path} at {self.video_fps} FPS")
                else:
                    print("[VideoRecorder] Could not get test frame from normal camera")
            else:
                print("[VideoRecorder] Normal camera not available for recording")
                
            # Set up thermal camera recording
            if self.camera_manager.is_thermal_available():
                thermal_camera = self.camera_manager.get_thermal_camera()
                if thermal_camera:
                    # Get a test frame to determine size
                    test_frame_data = thermal_camera.get_latest_frame()
                    if test_frame_data and isinstance(test_frame_data, tuple) and len(test_frame_data) == 2:
                        test_frame, _ = test_frame_data
                        h, w = test_frame.shape[:2]
                        thermal_video_path = os.path.join(self.recording_dir, f"thermal_{self.timestamp}.mp4")
                        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                        self.thermal_video_writer = cv2.VideoWriter(thermal_video_path, fourcc, self.video_fps, (w, h))
                        
                        # Start thermal camera recording thread
                        thermal_thread = threading.Thread(
                            target=self._record_thermal_video,
                            daemon=True
                        )
                        thermal_thread.start()
                        self.recording_threads.append(thermal_thread)
                        
                        # Start thermal data recording thread
                        thermal_data_thread = threading.Thread(
                            target=self._record_thermal_data,
                            daemon=True
                        )
                        thermal_data_thread.start()
                        self.recording_threads.append(thermal_data_thread)
                        
                        print(f"[VideoRecorder] Started thermal camera recording to {thermal_video_path} at {self.video_fps} FPS")
                        print(f"[VideoRecorder] Thermal data will be saved to {self.thermal_data_dir} at {self.thermal_data_fps} FPS")
                    else:
                        print("[VideoRecorder] Could not get test frame from thermal camera")
                else:
                    print("[VideoRecorder] Thermal camera object not available")
            else:
                print("[VideoRecorder] Thermal camera not available for recording")
                
            self.recording = True
            return {
                "success": True, 
                "timestamp": self.timestamp, 
                "directory": self.recording_dir,
                "thermal_data_fps": self.thermal_data_fps
            }
            
        except Exception as e:
            print(f"[VideoRecorder] Error starting recording: {e}")
            import traceback
            traceback.print_exc()
            self._cleanup_recording()
            return {"error": str(e)}
            
    def stop_recording(self):
        """Stop all ongoing recording"""
        if not self.recording:
            print("[VideoRecorder] Not currently recording")
            return {"error": "Not recording"}
            
        try:
            print("[VideoRecorder] Stopping video recording")
            # Set the stop flag to signal all threads to stop
            self.stop_flag.set()
            
            # Wait for all recording threads to finish (with timeout)
            for thread in self.recording_threads:
                thread.join(timeout=5.0)
            
            # Clean up resources
            self._cleanup_recording()
            
            # Return success info
            result = {
                "success": True,
                "timestamp": self.timestamp,
                "directory": self.recording_dir,
                "frames_recorded": self.frames_recorded
            }
            return result
            
        except Exception as e:
            print(f"[VideoRecorder] Error stopping recording: {e}")
            # Still try to clean up
            self._cleanup_recording()
            return {"error": str(e)}
            
    def _cleanup_recording(self):
        """Clean up recording resources"""
        # Release video writers
        if self.normal_video_writer:
            try:
                self.normal_video_writer.release()
            except Exception as e:
                print(f"[VideoRecorder] Error releasing normal video writer: {e}")
            self.normal_video_writer = None
            
        if self.thermal_video_writer:
            try:
                self.thermal_video_writer.release()
            except Exception as e:
                print(f"[VideoRecorder] Error releasing thermal video writer: {e}")
            self.thermal_video_writer = None
            
        # Reset recording state
        self.recording = False
        self.recording_threads = []
        print(f"[VideoRecorder] Recording resources cleaned up. Frames recorded: {self.frames_recorded}")
        
    def _record_normal_video(self):
        """Thread function to record video from the normal camera"""
        try:
            frame_interval = 1.0 / self.video_fps
            next_frame_time = time.time()
            
            while not self.stop_flag.is_set():
                if not self.camera_manager.is_camera_available() or not self.normal_video_writer:
                    break
                
                # Time-based frame capture to maintain consistent FPS
                current_time = time.time()
                if current_time >= next_frame_time:
                    # Calculate next frame time
                    next_frame_time = current_time + frame_interval
                    
                    # Capture a frame
                    frame = self.camera_manager.capture_normal_frame()
                    if frame is not None:
                        # Write the frame to the video file
                        self.normal_video_writer.write(frame)
                        self.frames_recorded["normal"] += 1
                        
                        # Print progress occasionally
                        if self.frames_recorded["normal"] % 100 == 0:
                            print(f"[VideoRecorder] Normal camera: {self.frames_recorded['normal']} frames recorded")
                    else:
                        # If we couldn't get a frame, adjust next frame time
                        next_frame_time = time.time() + frame_interval
                
                # Small sleep to prevent CPU overuse
                sleep_time = max(0.001, next_frame_time - time.time() - 0.002)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
            print(f"[VideoRecorder] Normal camera recording finished, {self.frames_recorded['normal']} frames recorded")
            
        except Exception as e:
            print(f"[VideoRecorder] Error in normal video recording thread: {e}")
            import traceback
            traceback.print_exc()
            
    def _record_thermal_video(self):
        """Thread function to record video from the thermal camera"""
        try:
            thermal_camera = self.camera_manager.get_thermal_camera()
            if not thermal_camera:
                print("[VideoRecorder] No thermal camera available for recording")
                return
                
            frame_interval = 1.0 / self.video_fps
            next_frame_time = time.time()
            
            while not self.stop_flag.is_set():
                if not self.camera_manager.is_thermal_available() or not self.thermal_video_writer:
                    break
                
                # Time-based frame capture to maintain consistent FPS
                current_time = time.time()
                if current_time >= next_frame_time:
                    # Calculate next frame time
                    next_frame_time = current_time + frame_interval
                    
                    # Get the latest frame
                    frame_data = thermal_camera.get_latest_frame()
                    if frame_data and isinstance(frame_data, tuple) and len(frame_data) == 2:
                        frame, _ = frame_data
                        # Write the frame to the video file
                        self.thermal_video_writer.write(frame)
                        self.frames_recorded["thermal"] += 1
                        
                        # Print progress occasionally
                        if self.frames_recorded["thermal"] % 100 == 0:
                            print(f"[VideoRecorder] Thermal camera: {self.frames_recorded['thermal']} frames recorded")
                    else:
                        # If we couldn't get a frame, adjust next frame time
                        next_frame_time = time.time() + frame_interval
                
                # Small sleep to prevent CPU overuse
                sleep_time = max(0.001, next_frame_time - time.time() - 0.002)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
            print(f"[VideoRecorder] Thermal camera recording finished, {self.frames_recorded['thermal']} frames recorded")
            
        except Exception as e:
            print(f"[VideoRecorder] Error in thermal video recording thread: {e}")
            import traceback
            traceback.print_exc()
            
    def _record_thermal_data(self):
        """Thread function to record thermal data as .npy files at specified FPS"""
        try:
            thermal_camera = self.camera_manager.get_thermal_camera()
            if not thermal_camera:
                print("[VideoRecorder] No thermal camera available for thermal data recording")
                return
            
            # Calculate frame interval based on requested FPS
            frame_interval = 1.0 / self.thermal_data_fps
            next_frame_time = time.time()
            
            print(f"[VideoRecorder] Thermal data recording started at {self.thermal_data_fps} FPS (interval: {frame_interval:.4f}s)")
                
            while not self.stop_flag.is_set():
                if not self.camera_manager.is_thermal_available():
                    break
                
                # Time-based frame capture to maintain consistent FPS
                current_time = time.time()
                if current_time >= next_frame_time:
                    # Calculate next frame time
                    next_frame_time = current_time + frame_interval
                    
                    # Check if we have access to raw temperature data
                    if hasattr(thermal_camera, '_raw_temps') and thermal_camera._raw_temps is not None:
                        # Save the raw temperature data
                        npy_path = os.path.join(self.thermal_data_dir, f"temp_data_{self.frames_recorded['thermal_data']:06d}.npy")
                        raw_temps = thermal_camera._raw_temps.copy()  # Copy to avoid race conditions
                        
                        np.save(npy_path, raw_temps)
                        self.frames_recorded["thermal_data"] += 1
                        
                        # Print progress occasionally
                        if self.frames_recorded["thermal_data"] % 10 == 0:
                            print(f"[VideoRecorder] Thermal data: {self.frames_recorded['thermal_data']} frames saved at {self.thermal_data_fps} FPS")
                    else:
                        # If raw temps not available, adjust next frame time
                        next_frame_time = time.time() + frame_interval
                
                # Small sleep to prevent CPU overuse
                sleep_time = max(0.001, next_frame_time - time.time() - 0.002)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
            print(f"[VideoRecorder] Thermal data recording finished, {self.frames_recorded['thermal_data']} frames saved")
            
        except Exception as e:
            print(f"[VideoRecorder] Error in thermal data recording thread: {e}")
            import traceback
            traceback.print_exc()

class CameraManager:
    """Manages all camera operations for the drone system"""
    def __init__(self):
        # Initialize camera instances as None
        self.camera_instance = None
        self.thermal_camera_instance = None
        
        # Create video recorder
        self.video_recorder = VideoRecorder(self)
        
        # Initialize cameras
        self._initialize_camera()
        self._initialize_thermal_camera()
    
    def _initialize_camera(self):
        """Initialize the regular camera (PiCamera2)"""
        if CAMERA_AVAILABLE and self.camera_instance is None:
            try:
                print("[Camera] Initializing PiCamera2")
                self.camera_instance = Picamera2()
                self.camera_instance.preview_configuration.main.size = (1280, 960)
                self.camera_instance.preview_configuration.main.format = "RGB888"
                self.camera_instance.preview_configuration.align()
                self.camera_instance.configure("preview")
                self.camera_instance.start()
                print("[Camera] PiCamera2 initialized and started")
                return True
            except Exception as e:
                print(f"[Camera] Error initializing PiCamera2: {e}")
                self.camera_instance = None
                return False
        return self.camera_instance is not None
    
    def _initialize_thermal_camera(self):
        """Initialize the thermal camera"""
        # Clean up old instance if it exists
        if self.thermal_camera_instance is not None:
            try:
                self.thermal_camera_instance.close()
            except Exception as e:
                print(f"[Camera] Error closing existing thermal camera: {e}")
        
        try:
            # Check if existing camera needs to be verified
            if self.thermal_camera_instance is not None:
                try:
                    if self.thermal_camera_instance.cap.isOpened():
                        print("[Camera] Existing thermal camera instance is open")
                        return True
                    print("[Camera] Existing thermal camera instance is not open, reinitializing")
                except Exception:
                    print("[Camera] Error checking existing thermal camera, reinitializing")
            
            # Try specific device path first
            device_candidates = ['/dev/andrei']
            
            # Look for available video devices
            picam_device = None  # Camera device used by PiCamera2
            available_cameras = []
            
            # First check if a PiCamera2 instance exists and is using a device
            if self.camera_instance and CAMERA_AVAILABLE:
                try:
                    # On Raspberry Pi, PiCamera2 typically uses /dev/video0
                    picam_device = 0
                    print(f"[Camera] PiCamera2 is active, likely using device {picam_device}")
                except Exception:
                    pass
            
            # Find available cameras
            for i in range(10):  # Try devices 0-9
                # Skip the device used by PiCamera2
                if i == picam_device:
                    print(f"[Camera] Skipping camera device {i} (used by PiCamera2)")
                    continue
                    
                try:
                    cap = cv2.VideoCapture(i)
                    if cap.isOpened():
                        available_cameras.append(i)
                        print(f"[Camera] Found available camera at index {i}")
                        cap.release()
                except Exception:
                    pass
            
            print(f"[Camera] Available camera devices: {available_cameras}")
            
            # Prioritize cameras other than device 0 (it's usually the built-in webcam)
            thermal_candidates = []
            if len(available_cameras) > 1 and 0 in available_cameras:
                # Put device 0 at the end of the list as a fallback
                thermal_candidates = [c for c in available_cameras if c != 0]
                thermal_candidates.append(0)
            else:
                thermal_candidates = available_cameras
            
            # Add the candidates to our paths to try
            device_candidates.extend(thermal_candidates)
            
            # Try each path
            for path in device_candidates:
                try:
                    print(f"[Camera] Trying to initialize thermal camera with device {path}")
                    self.thermal_camera_instance = ThermalCamera(device_path=path)
                    
                    # Verify the camera is working
                    if self.thermal_camera_instance.cap.isOpened():
                        print(f"[Camera] Thermal camera initialized successfully with device {path}")
                        return True
                    else:
                        print(f"[Camera] Failed to open thermal camera with device {path}")
                        self.thermal_camera_instance.close()
                        self.thermal_camera_instance = None
                except Exception as e:
                    print(f"[Camera] Error initializing thermal camera with device {path}: {e}")
            
            print("[Camera] Could not initialize thermal camera with any available device")
            return False
            
        except Exception as e:
            print(f"[Camera] Error in thermal camera initialization process: {e}")
            return False
    
    def is_camera_available(self):
        """Check if the regular camera is available"""
        return self.camera_instance is not None and CAMERA_AVAILABLE
    
    def is_thermal_available(self):
        """Check if the thermal camera is available and working"""
        if self.thermal_camera_instance is None:
            return False
            
        try:
            return self.thermal_camera_instance.cap.isOpened()
        except Exception:
            return False
    
    def get_camera(self):
        """Get the regular camera instance, initializing if needed"""
        if self.camera_instance is None:
            self._initialize_camera()
        return self.camera_instance
    
    def get_thermal_camera(self):
        """Get the thermal camera instance, initializing if needed"""
        if not self.is_thermal_available():
            self._initialize_thermal_camera()
        return self.thermal_camera_instance
    
    def capture_normal_frame(self):
        """Capture a frame from the regular camera"""
        if not self.is_camera_available():
            return None
            
        try:
            # Capture and flip the frame
            frame = self.camera_instance.capture_array()
            return cv2.flip(frame, -1)
        except Exception as e:
            print(f"[Camera] Error capturing frame: {e}")
            return None
    
    def start_video_recording(self, thermal_data_fps=1):
        """Start recording video from both cameras"""
        return self.video_recorder.start_recording(thermal_data_fps)
    
    def stop_video_recording(self):
        """Stop video recording"""
        return self.video_recorder.stop_recording()
    
    def is_recording(self):
        """Check if video is currently being recorded"""
        return self.video_recorder.recording
    
    def cleanup(self):
        """Clean up camera resources"""
        print("[Camera] Cleaning up camera resources")
        
        # Stop recording if active
        if self.video_recorder.recording:
            self.video_recorder.stop_recording()
        
        # Close the thermal camera
        if self.thermal_camera_instance is not None:
            try:
                self.thermal_camera_instance.close()
                print("[Camera] Thermal camera closed")
            except Exception as e:
                print(f"[Camera] Error closing thermal camera: {e}")
            self.thermal_camera_instance = None
        
        # Stop the regular camera
        if self.camera_instance is not None and CAMERA_AVAILABLE:
            try:
                self.camera_instance.stop()
                print("[Camera] Regular camera stopped")
            except Exception as e:
                print(f"[Camera] Error stopping regular camera: {e}")
            self.camera_instance = None