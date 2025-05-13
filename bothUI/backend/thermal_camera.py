import cv2
import numpy as np
import time
import io
import os
import threading
import queue

def is_raspberrypi():
    """Check if the code is running on a Raspberry Pi."""
    try:
        with io.open('/sys/firmware/devicetree/base/model', 'r') as m:
            if 'raspberry pi' in m.read().lower(): return True
    except Exception: pass
    return False

class ThermalCamera:
    def __init__(self, device_path='/dev/andrei'):
        """Initialize the thermal camera with specified device path."""
        self.device_path = device_path
        self.is_pi = is_raspberrypi()
        self.width = 256
        self.height = 192
        self.scale = 3
        self.new_width = self.width * self.scale
        self.new_height = self.height * self.scale
        
        # Image processing settings
        self.alpha = 1.0        # Contrast
        self.rad = 0            # Blur radius
        self.colormap = 0       # Default colormap (Jet)
        self.threshold = 2      # Temp threshold for labels
        self.threshold_temp = 30.0  # Temperature threshold for bbox
        self.detection_mode = "over"  # Mode for region detection: "over" or "under"
        self.rotation_angle = 270  # Default rotation angle
        self.detect_regions = True  # Whether to detect and draw bounding boxes
        self.show_hud = True    # Whether to show the heads-up display
        
        # Frame processing resources
        self.frame_queue = queue.Queue(maxsize=10)
        self.display_queue = queue.Queue(maxsize=10)
        self.stop_event = threading.Event()
        
        # Camera initialization
        self.initialize_camera()
        
        # Setup and start the processing threads
        self.setup_threads()
        
    def initialize_camera(self):
        """Initialize the thermal camera device."""
        try:
            # Before attempting to open the camera, check if the device path is a string or integer
            if isinstance(self.device_path, str) and self.device_path.startswith('/dev/'):
                # Check if the device file exists
                import os
                if not os.path.exists(self.device_path):
                    print(f"Device path {self.device_path} does not exist")
                    # Try a numerical device index instead
                    try:
                        device_index = 0  # Default to first camera
                        print(f"Trying to open thermal camera with index {device_index}")
                        self.cap = cv2.VideoCapture(device_index)
                    except Exception as index_err:
                        print(f"Error opening camera with index {device_index}: {index_err}")
                        return False
                else:
                    # Device file exists, try to open it
                    self.cap = cv2.VideoCapture(self.device_path, cv2.CAP_V4L)
            else:
                # If device_path is an integer or doesn't start with /dev/, treat it as an index
                self.cap = cv2.VideoCapture(int(self.device_path))
            
            # Configure camera settings
            if self.cap.isOpened():
                if self.is_pi:
                    self.cap.set(cv2.CAP_PROP_CONVERT_RGB, 0.0)
                else:
                    self.cap.set(cv2.CAP_PROP_CONVERT_RGB, False)
                    
                # Don't change camera resolution - thermal camera has a specific format
                
                print(f"Thermal camera initialized successfully with device {self.device_path}")
                return True
            else:
                print(f"Failed to open thermal camera at {self.device_path}")
                return False
        except Exception as e:
            print(f"Error initializing thermal camera: {e}")
            return False
        
    def setup_threads(self):
        """Set up and start the frame capture and processing threads."""
        # Create and start the frame reader thread
        self.frame_reader_thread = threading.Thread(
            target=self._read_frames_thread,
            daemon=True
        )
        
        # Create and start the frame processor thread
        self.processor_thread = threading.Thread(
            target=self._process_frames_thread,
            daemon=True
        )
        
        # Start threads
        self.frame_reader_thread.start()
        self.processor_thread.start()
    
    def _read_frames_thread(self):
        """Thread function to continuously read frames from the camera."""
        reconnect_attempts = 0
        max_reconnect_attempts = 5
        
        try:
            while not self.stop_event.is_set():
                if not self.cap.isOpened():
                    if reconnect_attempts < max_reconnect_attempts:
                        print(f"Camera disconnected, attempting to reconnect... ({reconnect_attempts+1}/{max_reconnect_attempts})")
                        reconnect_attempts += 1
                        time.sleep(2)  # Longer sleep between attempts
                        success = self.initialize_camera()
                        if not success:
                            print("Failed to reconnect thermal camera")
                        continue
                    else:
                        print("Max reconnect attempts reached, stopping thermal camera thread")
                        # Send a None frame to indicate termination
                        try:
                            self.frame_queue.put(None, timeout=1)
                        except queue.Full:
                            pass
                        # Wait for a longer period before retrying
                        time.sleep(30)
                        reconnect_attempts = 0  # Reset counter after long wait
                        continue
                        
                # If we got this far, we have an open camera
                reconnect_attempts = 0  # Reset counter on successful reads
                    
                ret, frame = self.cap.read()
                
                if not ret:
                    print("Failed to read frame from thermal camera")
                    time.sleep(0.1)
                    continue
                    
                try:
                    # Put frame in queue with timeout to allow checking stop event
                    self.frame_queue.put(frame, timeout=1)
                except queue.Full:
                    # If queue is full, skip this frame
                    pass
                    
                # Control frame rate
                time.sleep(0.033)  # ~30 FPS
        except Exception as e:
            print(f"Error in thermal camera frame reading: {e}")
        finally:
            # Signal end of frames
            try:
                self.frame_queue.put(None, timeout=1)
            except queue.Full:
                pass
    
    def _process_frames_thread(self):
        """Process thermal frames and extract temperature data."""
        try:
            while not self.stop_event.is_set():
                try:
                    # Get frame with timeout
                    frame = self.frame_queue.get(timeout=1)
                    
                    if frame is None:  # Termination signal
                        break
                        
                    # Process the frame
                    try:
                        processed_frame, temp_data = self.process_frame(frame)
                        
                        # Save last successful processed frame for backup
                        self.last_processed_frame = (processed_frame, temp_data)
                        
                        try:
                            # Put processed frame in display queue
                            self.display_queue.put((processed_frame, temp_data), timeout=1)
                        except queue.Full:
                            # If display queue is full, skip this frame
                            pass
                    except Exception as frame_err:
                        # Only print the first few errors or if it's a new type of error
                        if not hasattr(self, '_error_types'):
                            self._error_types = set()
                            self._error_count = 0
                        
                        error_type = type(frame_err).__name__
                        if error_type not in self._error_types or self._error_count < 3:
                            print(f"Error processing thermal frame: {frame_err}")
                            self._error_types.add(error_type)
                            self._error_count += 1
                        # Create error frame
                        error_frame = np.zeros((576, 768, 3), dtype=np.uint8)
                        cv2.putText(
                            error_frame, 
                            f"Processing error: {str(frame_err)}", 
                            (50, 288),
                            cv2.FONT_HERSHEY_SIMPLEX, 
                            0.7, 
                            (0, 0, 255), 
                            2
                        )
                        
                        error_data = {"error": str(frame_err)}
                        
                        try:
                            # Put error frame in display queue
                            self.display_queue.put((error_frame, error_data), timeout=1)
                        except queue.Full:
                            pass
                        
                except queue.Empty:
                    # If no frame is available, just continue
                    continue
                    
        except Exception as e:
            print(f"Error in thermal frame processing thread: {e}")
    
    def process_frame(self, frame):
        """Process a single thermal frame and return the processed frame and temperature data."""
        try:
            # Check frame size and format to determine if it's a thermal camera or regular camera
            frame_height, frame_width = frame.shape[:2]
            
            # Suppress all debug frame information
            if not hasattr(self, '_debug_counter'):
                self._debug_counter = 2  # Set initial counter past the threshold
            if not hasattr(self, '_last_frame_shape'):
                self._last_frame_shape = frame.shape
            
            # Debug logging to track raw temp storage
            self._last_frame_time = time.time()
            
            # Check if this looks like thermal camera data (for debugging only)
            is_thermal_format = (frame_width >= frame_height * 2)
            
            # Accept all camera formats and attempt processing
            # This is thermal camera format - split it
            try:
                # Split the frame into image data and thermal data - match exact logic from thermal.py
                try:
                    # EXACTLY match thermal.py's processing - don't specify axis in array_split
                    # This is critical because different thermal cameras format data differently
                    imdata, thdata = np.array_split(frame, 2)
                    
                    # Convert thermal data to uint16 to prevent overflow - exactly as in thermal.py
                    thdata_uint16 = thdata.astype(np.uint16)
                    
                    # Use exact formula from thermal.py - don't assume channel structure
                    raw_temps = (thdata_uint16[...,0] + thdata_uint16[...,1] * 256) / 64 - 273.15
                    
                    # Store raw temperatures for bounding box detection
                    self._raw_temps = raw_temps.copy()
                    
                    # Store basic statistics about the temperature data
                    self._raw_temps_stats = {
                        'min': float(raw_temps.min()),
                        'max': float(raw_temps.max()),
                        'mean': float(raw_temps.mean()),
                        'shape': raw_temps.shape
                    }
                except Exception as split_error:
                    print(f"Error splitting thermal frame: {split_error}, frame shape: {frame.shape}")
                    # Re-raise with more context
                    raise Exception(f"Failed to process thermal frame: {split_error}")
                
                # Get center coordinates based on actual frame size
                center_y = raw_temps.shape[0] // 2
                center_x = raw_temps.shape[1] // 2
                
                # Extract key temperature data
                temp = round(raw_temps[center_y, center_x], 2)  # Center temperature
                maxtemp = round(raw_temps.max(), 2)  # Max temperature
                mintemp = round(raw_temps.min(), 2)  # Min temperature
                avgtemp = round(raw_temps.mean(), 2)  # Average temperature
            except Exception as e:
                raise Exception(f"Error processing thermal data: {e}")
            
            # Get positions of max and min temperatures
            posmax = np.unravel_index(np.argmax(raw_temps), raw_temps.shape)
            posmin = np.unravel_index(np.argmin(raw_temps), raw_temps.shape)
            
            # Convert positions to x and y coordinates
            max_y, max_x = posmax
            min_y, min_x = posmin
            
            # Scale positions for display
            max_point = np.array([max_x * self.scale, max_y * self.scale])
            min_point = np.array([min_x * self.scale, min_y * self.scale])
            
            # Try to exactly match thermal.py's processing - line 181
            try:
                # First try with YUV conversion as in thermal.py
                bgr = cv2.cvtColor(imdata, cv2.COLOR_YUV2BGR_YUYV)
            except Exception as color_error:
                print(f"Color conversion error: {color_error}, trying alternate method")
                # If YUV conversion fails, try to use the image data directly
                if len(imdata.shape) == 3:
                    # If already a color image, use it directly
                    bgr = imdata
                else:
                    # If grayscale, convert to color (most thermal displays are false-color anyway)
                    bgr = cv2.cvtColor(imdata, cv2.COLOR_GRAY2BGR)
            
            # Apply contrast adjustment
            bgr = cv2.convertScaleAbs(bgr, alpha=self.alpha)
            
            # Resize image to our standard size
            bgr = cv2.resize(bgr, (self.new_width, self.new_height), interpolation=cv2.INTER_CUBIC)
            
            # Apply blur if radius > 0
            if self.rad > 0:
                bgr = cv2.blur(bgr, (self.rad, self.rad))
            
            # Apply colormap based on current setting
            colormap_types = [
                (cv2.COLORMAP_JET, 'Jet'),
                (cv2.COLORMAP_HOT, 'Hot'),
                (cv2.COLORMAP_MAGMA, 'Magma'),
                (cv2.COLORMAP_INFERNO, 'Inferno'),
                (cv2.COLORMAP_PLASMA, 'Plasma'),
                (cv2.COLORMAP_BONE, 'Bone'),
                (cv2.COLORMAP_SPRING, 'Spring'),
                (cv2.COLORMAP_AUTUMN, 'Autumn'),
                (cv2.COLORMAP_VIRIDIS, 'Viridis'),
                (cv2.COLORMAP_PARULA, 'Parula')
            ]
            
            # Ensure colormap index is valid
            current_map_idx = self.colormap % len(colormap_types)
            current_map, colormap_name = colormap_types[current_map_idx]
            
            # Apply the selected colormap
            heatmap = cv2.applyColorMap(bgr, current_map)
            
            # Special handling for rainbow colormap
            if self.colormap == 10:
                heatmap = cv2.applyColorMap(bgr, cv2.COLORMAP_RAINBOW)
                heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
                colormap_name = 'Inv Rainbow'
            
            # Prepare points for rotation
            center_point = np.array([self.new_width / 2, self.new_height / 2])
            
            # Crosshair lines
            crosshair_lines = [
                (center_point + [0, 20], center_point - [0, 20]),
                (center_point + [20, 0], center_point - [20, 0])
            ]
            
            # Text position
            temp_text_pos = center_point + [10, -10]
            
            # Points for rotation
            points_to_rotate = np.array([max_point, min_point, temp_text_pos])
            all_lines = [line for line_pair in crosshair_lines for line in line_pair]
            points_to_rotate = np.vstack([points_to_rotate, all_lines])
            
            # Rotate image and points
            rotated_heatmap, rotated_points = self._rotate_image_and_points(
                heatmap, self.rotation_angle, points_to_rotate
            )
            
            # Extract rotated points
            max_point_rotated = rotated_points[0]
            min_point_rotated = rotated_points[1]
            temp_text_pos_rotated = rotated_points[2]
            crosshair_points_rotated = rotated_points[3:]
            
            # Reshape crosshair points
            crosshair_lines_rotated = [
                (crosshair_points_rotated[0], crosshair_points_rotated[1]),
                (crosshair_points_rotated[2], crosshair_points_rotated[3])
            ]
            
            # Update heatmap
            heatmap = rotated_heatmap
            
            # Draw crosshairs
            for line_start, line_end in crosshair_lines_rotated:
                line_start = tuple(map(int, line_start))
                line_end = tuple(map(int, line_end))
                cv2.line(heatmap, line_start, line_end, (255, 255, 255), 2)
                cv2.line(heatmap, line_start, line_end, (0, 0, 0), 1)
            
            # Use actual temperature value
            center_temp = temp
            
            # Show temperature at center crosshair
            cv2.putText(
                heatmap, 
                f"{center_temp:.1f} C", 
                tuple(map(int, temp_text_pos_rotated)),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.45, 
                (0, 0, 0), 
                2, 
                cv2.LINE_AA
            )
            cv2.putText(
                heatmap, 
                f"{center_temp:.1f} C", 
                tuple(map(int, temp_text_pos_rotated)),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.45, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
            # Add information overlay
            self._add_info_overlay(
                heatmap, 
                avgtemp, 
                colormap_name,
                maxtemp, 
                mintemp, 
                max_point_rotated, 
                min_point_rotated
            )
            
            # Create temperature data dictionary
            temp_data = {
                'center': temp,
                'max': maxtemp,
                'min': mintemp,
                'avg': avgtemp,
                'max_pos': (int(max_point_rotated[0]), int(max_point_rotated[1])),
                'min_pos': (int(min_point_rotated[0]), int(min_point_rotated[1]))
            }
            
            return heatmap, temp_data
            
        except Exception as e:
            # Only print the first few errors to reduce console spam
            if not hasattr(self, '_process_error_count'):
                self._process_error_count = 0
            
            if self._process_error_count < 3:
                print(f"Error processing thermal frame: {e}")
                self._process_error_count += 1
            # Return a black image with error message if processing fails
            blank = np.zeros((self.new_height, self.new_width, 3), dtype=np.uint8)
            cv2.putText(
                blank, 
                "Thermal camera error", 
                (50, self.new_height // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 
                1, 
                (0, 0, 255), 
                2
            )
            return blank, {'error': str(e)}
    
    def _rotate_image_and_points(self, image, angle, points, center=None, scale=1.0):
        """Rotate the image and points around a center point."""
        # Get image dimensions
        (h, w) = image.shape[:2]
        if center is None:
            center = (w // 2, h // 2)
        
        # Compute rotation matrix
        M = cv2.getRotationMatrix2D(center, angle, scale)
        
        # Perform rotation on image
        rotated_image = cv2.warpAffine(image, M, (w, h))
        
        # If raw temperature data exists, also rotate it for accurate bounding box temperatures
        if hasattr(self, '_raw_temps') and self._raw_temps is not None:
            # Resize temperature data to match display size
            temps_resized = cv2.resize(self._raw_temps, (self.new_width, self.new_height), 
                                     interpolation=cv2.INTER_NEAREST)
            
            # Rotate the temperature data
            self._rotated_temps = cv2.warpAffine(temps_resized, M, (w, h))
        
        # Rotate points
        ones = np.ones(shape=(len(points), 1))
        points_ones = np.hstack([points, ones])
        rotated_points = M.dot(points_ones.T).T
        
        return rotated_image, rotated_points
    
    def _add_info_overlay(self, heatmap, avgtemp, colormap_name, maxtemp, mintemp, max_point, min_point):
        """Add informational overlay to the heatmap image."""
        # Initialize debug counter if needed
        if not hasattr(self, '_temp_debug_counter'):
            self._temp_debug_counter = 0
        
        # Only show HUD if enabled
        if self.show_hud:
            # Display black box for data
            cv2.rectangle(heatmap, (0, 0), (180, 100), (0, 0, 0), -1)
            
            # Put text in the box
            cv2.putText(
                heatmap, 
                f'Avg Temp: {avgtemp:.1f} C', 
                (10, 14),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.4, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
            cv2.putText(
                heatmap, 
                f'Colormap: {colormap_name}', 
                (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.4, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
            cv2.putText(
                heatmap, 
                f'Contrast: {self.alpha}', 
                (10, 42),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.4, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
            cv2.putText(
                heatmap, 
                f'Blur: {self.rad}', 
                (10, 56),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.4, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
            cv2.putText(
                heatmap, 
                f'Rotation: {self.rotation_angle % 360} deg', 
                (10, 70),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.4, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
            # Display the actual threshold temperature and detection mode
            mode_text = "Over" if self.detection_mode == "over" else "Under"
            cv2.putText(
                heatmap, 
                f'Temp Threshold: {self.threshold_temp:.1f}°C ({mode_text})', 
                (10, 84),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.4, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )

        # Display floating max temp
        if maxtemp > avgtemp + self.threshold:
            x, y = max_point
            cv2.circle(heatmap, (int(x), int(y)), 5, (0, 0, 0), 2)
            cv2.circle(heatmap, (int(x), int(y)), 5, (0, 0, 255), -1)
            cv2.putText(
                heatmap, 
                f"{maxtemp:.1f} C", 
                (int(x) + 10, int(y) + 5),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.45, 
                (0, 0, 0), 
                2, 
                cv2.LINE_AA
            )
            cv2.putText(
                heatmap, 
                f"{maxtemp:.1f} C", 
                (int(x) + 10, int(y) + 5),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.45, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
        
        # Display floating min temp
        if mintemp < avgtemp - self.threshold:
            x, y = min_point
            cv2.circle(heatmap, (int(x), int(y)), 5, (0, 0, 0), 2)
            cv2.circle(heatmap, (int(x), int(y)), 5, (255, 0, 0), -1)
            cv2.putText(
                heatmap, 
                f"{mintemp:.1f} C", 
                (int(x) + 10, int(y) + 5),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.45, 
                (0, 0, 0), 
                2, 
                cv2.LINE_AA
            )
            cv2.putText(
                heatmap, 
                f"{mintemp:.1f} C", 
                (int(x) + 10, int(y) + 5),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.45, 
                (0, 255, 255), 
                1, 
                cv2.LINE_AA
            )
            
        # Create temperature regions with bounding boxes
        if hasattr(self, 'detect_regions') and self.detect_regions:
            # Create a mask where temperatures exceed threshold
            try:
                # Get raw temperatures from the process_frame method
                if '_raw_temps' in self.__dict__ and self._raw_temps is not None:
                    # Initialize debug timestamp if needed
                    if not hasattr(self, '_last_debug_print'):
                        self._last_debug_print = time.time()
                    
                    # Create a binary mask for temperatures based on detection mode
                    # Using the unmodified threshold value
                    try:
                        mask = np.zeros_like(self._raw_temps, dtype=np.uint8)
                        if self.detection_mode == "over":
                            # For regions above threshold
                            mask[self._raw_temps >= self.threshold_temp] = 255
                        elif self.detection_mode == "under":
                            # For regions below threshold
                            mask[self._raw_temps <= self.threshold_temp] = 255
                    except Exception as mask_error:
                        print(f"Error creating temperature mask: {mask_error}, raw_temps shape: {self._raw_temps.shape}")
                        # Create a simple blank mask as fallback
                        mask = np.zeros((self.height, self.width), dtype=np.uint8)
                    
                    # Resize mask to match display size
                    mask_resized = cv2.resize(mask, (self.new_width, self.new_height), 
                                            interpolation=cv2.INTER_NEAREST)
                    
                    # Rotate mask if needed
                    if self.rotation_angle != 0:
                        mask_rotated = cv2.warpAffine(
                            mask_resized, 
                            cv2.getRotationMatrix2D(
                                (self.new_width // 2, self.new_height // 2), 
                                self.rotation_angle, 
                                1.0
                            ), 
                            (self.new_width, self.new_height)
                        )
                    else:
                        mask_rotated = mask_resized
                    
                    # Find contours in the mask
                    contours, _ = cv2.findContours(mask_rotated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    
                    # Draw bounding boxes around areas exceeding the threshold
                    for contour in contours:
                        # Only draw boxes for areas larger than a minimum size
                        area = cv2.contourArea(contour)
                        if area < 100:  # Skip very small regions
                            continue
                            
                        # Get bounding rectangle
                        x, y, w, h = cv2.boundingRect(contour)
                        # Use different colors based on detection mode
                        box_color = (0, 255, 0) if self.detection_mode == "over" else (0, 0, 255)  # Green for over, Red for under
                        cv2.rectangle(heatmap, (x, y), (x+w, y+h), box_color, 2)
                        
                        # Show the temperature in the bounding box
                        # Get the temperature in the center of the bounding box
                        if not hasattr(self, '_rotated_temps') or self._rotated_temps is None:
                            continue
                            
                        center_x, center_y = x + w//2, y + h//2
                        try:
                            # Use the actual temperature value without correction
                            detected_temp = self._rotated_temps[center_y, center_x]
                            
                            temp_text = f"{detected_temp:.1f}°C"
                            # Use different text colors based on detection mode and temperature
                            if self.detection_mode == "over":
                                # Green for over threshold temperatures
                                text_color = (0, 255, 0)
                            else:
                                # Blue for under threshold temperatures
                                text_color = (0, 0, 255)
                            cv2.putText(
                                heatmap,
                                temp_text,
                                (x, y-5),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.5,
                                text_color,
                                1,
                                cv2.LINE_AA
                            )
                        except:
                            pass
            except Exception as e:
                # Only show error the first few times
                if not hasattr(self, '_bbox_errors'):
                    self._bbox_errors = 0
                
                if self._bbox_errors < 3:
                    print(f"Error drawing temperature bounding boxes: {e}")
                    self._bbox_errors += 1
    
    def get_latest_frame(self):
        """Return the latest processed thermal frame."""
        try:
            # First check if camera is still open
            if not hasattr(self, 'cap') or not self.cap.isOpened():
                print("Thermal camera is not open in get_latest_frame")
                return None
                
            # Try to get a frame with a short timeout
            try:
                frame_data = self.display_queue.get(block=True, timeout=0.1)
                return frame_data
            except queue.Empty:
                # Create a simple status frame if queue is empty
                if hasattr(self, 'last_processed_frame') and self.last_processed_frame is not None:
                    return self.last_processed_frame
                else:
                    # Create simple status frame
                    status_frame = np.zeros((576, 768, 3), dtype=np.uint8)
                    cv2.putText(
                        status_frame, 
                        "Waiting for thermal data...", 
                        (50, 288),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        1, 
                        (0, 200, 200), 
                        2
                    )
                    return status_frame, {"status": "waiting"}
        except Exception as e:
            print(f"Error in get_latest_frame: {e}")
            return None
    
    def set_colormap(self, colormap_idx):
        """Set the colormap to use for thermal visualization."""
        self.colormap = colormap_idx % 11
    
    def set_contrast(self, value):
        """Set the contrast value (0.0-3.0)."""
        self.alpha = max(0.0, min(3.0, value))
    
    def set_blur(self, value):
        """Set the blur radius."""
        self.rad = max(0, value)
    
    def set_rotation(self, angle):
        """Set the rotation angle in degrees."""
        angle = angle % 360
        if self.rotation_angle != angle:
            print(f"Setting rotation from {self.rotation_angle} to {angle} degrees")
            self.rotation_angle = angle
        else:
            print(f"Rotation angle already set to {angle} degrees")
    
    def set_threshold(self, value):
        """Set the temperature threshold for labeling."""
        self.threshold = max(0, value)
    
    def set_temp_threshold(self, value):
        """Set the temperature threshold for bounding boxes."""
        self.threshold_temp = value
    
    def set_detect_regions(self, value):
        """Enable or disable region detection with bounding boxes."""
        value = bool(value)
        if self.detect_regions != value:
            print(f"Setting detect_regions from {self.detect_regions} to {value}")
            self.detect_regions = value
            
            # Check if we have temperature data for bounding boxes
            has_raw_temps = hasattr(self, '_raw_temps') and self._raw_temps is not None
            print(f"Raw temperature data available: {has_raw_temps}")
            if has_raw_temps:
                print(f"Raw temps shape: {self._raw_temps.shape}, min: {self._raw_temps.min():.1f}, max: {self._raw_temps.max():.1f}, threshold: {self.threshold_temp}")
        else:
            print(f"Region detection already set to {value}")
    
    def set_detection_mode(self, mode):
        """Set the detection mode for bounding boxes (over or under threshold)."""
        if mode not in ["over", "under"]:
            print(f"Invalid detection mode: {mode}. Must be 'over' or 'under'")
            return
        
        if self.detection_mode != mode:
            print(f"Setting detection mode from {self.detection_mode} to {mode}")
            self.detection_mode = mode
            
            # Check if we have temperature data for bounding boxes
            has_raw_temps = hasattr(self, '_raw_temps') and self._raw_temps is not None
            if has_raw_temps:
                print(f"Detection mode changed to {mode}, threshold: {self.threshold_temp}°C")
        else:
            print(f"Detection mode already set to {mode}")
    
    def toggle_hud(self):
        """Toggle the heads-up display on/off."""
        self.show_hud = not self.show_hud
        print(f"HUD display: {'ON' if self.show_hud else 'OFF'}")
    
    def capture_images(self, normal_camera_frame=None):
        """
        Capture and save the thermal camera image, normal camera image, and temperature matrix.
        
        Args:
            normal_camera_frame: Optional frame from the regular camera to save alongside thermal
        
        Returns:
            dict: Paths to the saved files
        """
        try:
            print("[ThermalCamera] Starting image capture process")
            # Create directory structure if it doesn't exist
            import os
            
            # Try different directories in order of preference
            possible_dirs = [
                '/home/andre/Documents/env/cityDrone/drone_captures',
                os.path.expanduser('~/drone_captures'),  # User's home directory
                '/tmp/drone_captures',                   # /tmp should be writable
                '.'                                     # Current directory as last resort
            ]
            
            capture_dir = None
            for dir_path in possible_dirs:
                print(f"[ThermalCamera] Trying directory: {dir_path}")
                try:
                    if not os.path.exists(dir_path):
                        print(f"[ThermalCamera] Directory doesn't exist, creating it")
                        os.makedirs(dir_path, exist_ok=True)
                    
                    # Test if directory is writable by creating a test file
                    test_file = os.path.join(dir_path, '.write_test')
                    with open(test_file, 'w') as f:
                        f.write('test')
                    os.remove(test_file)
                    
                    capture_dir = dir_path
                    print(f"[ThermalCamera] Successfully using directory: {capture_dir}")
                    break
                except Exception as dir_err:
                    print(f"[ThermalCamera] Failed to use directory {dir_path}: {dir_err}")
            
            if capture_dir is None:
                print("[ThermalCamera] Failed to find a writable directory")
                return {"error": "Failed to find a writable directory for captures"}
            
            # Generate timestamp for filenames
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            print(f"[ThermalCamera] Generated timestamp: {timestamp}")
            
            # Get the latest thermal frame and data
            print("[ThermalCamera] Getting latest thermal frame")
            frame_data = self.get_latest_frame()
            if not frame_data:
                print("[ThermalCamera] No thermal frame available to capture")
                return {"error": "No thermal frame available to capture"}
            
            print("[ThermalCamera] Got thermal frame, processing")
            thermal_frame, temp_data = frame_data
            
            # Save thermal image
            thermal_path = os.path.join(capture_dir, f"thermal_{timestamp}.png")
            print(f"[ThermalCamera] Saving thermal image to: {thermal_path}")
            result = cv2.imwrite(thermal_path, thermal_frame)
            if not result:
                print(f"[ThermalCamera] Failed to save thermal image")
                return {"error": "Failed to save thermal image"}
            print(f"[ThermalCamera] Thermal image saved successfully")
            
            # Save temperature matrix if available
            temp_matrix_path = os.path.join(capture_dir, f"temp_matrix_{timestamp}.npy")
            if hasattr(self, '_raw_temps') and self._raw_temps is not None:
                print(f"[ThermalCamera] Saving temperature matrix to: {temp_matrix_path}")
                try:
                    np.save(temp_matrix_path, self._raw_temps)
                    print(f"[ThermalCamera] Temperature matrix saved successfully")
                except Exception as temp_err:
                    print(f"[ThermalCamera] Failed to save temperature matrix: {temp_err}")
                    temp_matrix_path = None
            else:
                print("[ThermalCamera] No raw temperature data available")
                temp_matrix_path = None
            
            # Save normal camera frame if provided
            normal_path = None
            if normal_camera_frame is not None:
                print("[ThermalCamera] Normal camera frame provided")
                normal_path = os.path.join(capture_dir, f"normal_{timestamp}.png")
                print(f"[ThermalCamera] Saving normal camera image to: {normal_path}")
                result = cv2.imwrite(normal_path, normal_camera_frame)
                if not result:
                    print(f"[ThermalCamera] Failed to save normal camera image")
                    normal_path = None
                else:
                    print(f"[ThermalCamera] Normal camera image saved successfully")
            else:
                print("[ThermalCamera] No normal camera frame provided")
            
            print(f"[ThermalCamera] All images captured and saved to {capture_dir}")
            return {
                "thermal_path": thermal_path,
                "temp_matrix_path": temp_matrix_path,
                "normal_path": normal_path,
                "timestamp": timestamp
            }
        except Exception as e:
            print(f"[ThermalCamera] Error capturing images: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}
    
    def close(self):
        """Close the thermal camera and stop processing threads."""
        self.stop_event.set()
        
        if hasattr(self, 'cap') and self.cap.isOpened():
            self.cap.release()
            
        # Wait for threads to finish
        if hasattr(self, 'frame_reader_thread') and self.frame_reader_thread.is_alive():
            self.frame_reader_thread.join(timeout=2)
            
        if hasattr(self, 'processor_thread') and self.processor_thread.is_alive():
            self.processor_thread.join(timeout=2)
        
        print("Thermal camera resources released")

# Testing the thermal camera module
if __name__ == "__main__":
    # Create the thermal camera
    thermal_cam = ThermalCamera()
    
    try:
        # Display window for testing
        cv2.namedWindow('Thermal Test', cv2.WINDOW_NORMAL)
        cv2.resizeWindow('Thermal Test', thermal_cam.new_width, thermal_cam.new_height)
        
        print('Thermal Camera Test - Press Q to exit')
        print('Controls:')
        print('C: Cycle colormap')
        print('+ / -: Adjust contrast')
        print('B / N: Increase/decrease blur')
        print('R: Rotate 90 degrees')
        print('H: Toggle HUD (heads-up display)')
        
        while True:
            # Get the latest frame
            frame_data = thermal_cam.get_latest_frame()
            
            if frame_data:
                frame, temp_data = frame_data
                
                # Show the frame
                cv2.imshow('Thermal Test', frame)
                
                # Print temperature data occasionally
                if time.time() % 2 < 0.1:
                    print(f"Center: {temp_data['center']}°C, "
                          f"Max: {temp_data['max']}°C, "
                          f"Min: {temp_data['min']}°C, "
                          f"Avg: {temp_data['avg']}°C")
            
            # Check for key presses
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q'):
                break
            elif key == ord('c'):
                thermal_cam.set_colormap(thermal_cam.colormap + 1)
            elif key == ord('+'):
                thermal_cam.set_contrast(thermal_cam.alpha + 0.1)
            elif key == ord('-'):
                thermal_cam.set_contrast(thermal_cam.alpha - 0.1)
            elif key == ord('b'):
                thermal_cam.set_blur(thermal_cam.rad + 1)
            elif key == ord('n'):
                thermal_cam.set_blur(max(0, thermal_cam.rad - 1))
            elif key == ord('r'):
                thermal_cam.set_rotation(thermal_cam.rotation_angle + 90)
    
    finally:
        # Clean up
        thermal_cam.close()
        cv2.destroyAllWindows()