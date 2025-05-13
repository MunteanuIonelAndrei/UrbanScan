#!/usr/bin/env python3
"""
drone_control.py
---------
Handles all drone-specific flight control functionality
Interfaces with the Pixhawk flight controller via DroneKit
"""

import time
import threading
import math
import numpy as np
from collections import deque

# Import drone control libraries
try:
    from dronekit import connect, VehicleMode, LocationGlobalRelative
    from pymavlink import mavutil
    DRONE_KIT_AVAILABLE = True
except ImportError as e:
    DRONE_KIT_AVAILABLE = False
    print(f"[Drone] DroneKit not available: {e}. Flight controls won't work.")

class DroneController:
    """Manages drone flight control operations"""
    
    def __init__(self, led_controller=None):
        self.led_controller = led_controller
        self.vehicle = None
        self.is_available = False
        self.current_tilt_pwm = 1000  # Default middle position (range is usually 600-1650)
        self.last_pwm_value = 1000  # Keep track of the last PWM value
        
        # Initialize connection to the flight controller
        self._initialize_vehicle()
    
    def _initialize_vehicle(self):
        """Initialize the connection to the Pixhawk controller"""
        if not DRONE_KIT_AVAILABLE:
            print("[Drone] DroneKit not available. Flight control disabled.")
            return False
        
        try:
            print("[Drone] Connecting to Pixhawk...")
            # Connect to the vehicle - timeouts after 60 seconds
            self.vehicle = connect('/dev/drona', wait_ready=True, timeout=60)
            print(f"[Drone] Connected to Pixhawk: {self.vehicle.version}")
            
            # Initialize channel overrides
            if not hasattr(self.vehicle.channels, 'overrides'):
                print("[Drone] Creating channel overrides dictionary")
                self.vehicle.channels.overrides = {}
            
            # Set initial flight mode to STABILIZE
            try:
                self.vehicle.mode = VehicleMode("STABILIZE")
                print(f"[Drone] Flight mode set to: {self.vehicle.mode.name}")
            except Exception as e:
                print(f"[Drone] Error setting initial flight mode: {e}")
            
            # Add listeners for important drone info
            # Store reference to controller instance
            controller = self

            # We're not using any message listeners for now
            # @self.vehicle.on_message('SYS_STATUS')
            # def listener(vehicle_self, name, message):
            #     pass
            
            # Log basic drone info
            print(f"[Drone] Battery: {self.vehicle.battery.level}%")
            print(f"[Drone] GPS: {self.vehicle.gps_0.fix_type} - Satellites: {self.vehicle.gps_0.satellites_visible}")
            print(f"[Drone] Armed: {self.vehicle.armed}")
            
            # Set camera tilt to middle position
            self.set_servo(9, 1000)
            
            self.is_available = True
            return True
            
        except Exception as e:
            print(f"[Drone] Failed to connect to Pixhawk: {e}")
            print("[Drone] Check if the Pixhawk is properly connected at '/dev/drona'")
            self.vehicle = None
            self.is_available = False
            return False
    
    
    def set_servo(self, servo_num, pwm_value):
        """Control a servo connected to Pixhawk"""
        if servo_num == 9:  # Camera tilt servo
            self.last_pwm_value = pwm_value
            
        try:
            print(f"[Drone] Setting servo {servo_num} to PWM {pwm_value}")
            
            if self.is_available and self.vehicle:
                # Send command to Pixhawk
                msg = self.vehicle.message_factory.command_long_encode(
                    0, 0,  # target system, target component
                    mavutil.mavlink.MAV_CMD_DO_SET_SERVO,
                    0,  # confirmation
                    servo_num,  # servo number
                    pwm_value,  # PWM value
                    0, 0, 0, 0, 0  # unused parameters
                )
                self.vehicle.send_mavlink(msg)
                print(f"[Drone] Sent servo command to Pixhawk")
                return True
            else:
                print(f"[Drone] Pixhawk not connected, servo command simulated")
                return False
        except Exception as e:
            print(f"[Drone] Error setting servo: {e}")
            return False
    
    def set_rc_channel(self, channel_num, pwm_value):
        """Set an RC channel to a specific PWM value"""
        try:
            # Ensure channel_num is an integer
            channel_num = int(channel_num)
            
            # Ensure PWM is an integer and in valid range
            if not isinstance(pwm_value, int):
                pwm_value = int(round(float(pwm_value)))
                
            pwm_value = max(1000, min(2000, pwm_value))
            
            print(f"[Drone] Setting RC channel {channel_num} to PWM {pwm_value}")
            
            if self.is_available and self.vehicle:
                # Ensure we have an overrides dictionary
                if not hasattr(self.vehicle.channels, 'overrides') or self.vehicle.channels.overrides is None:
                    self.vehicle.channels.overrides = {}
                    
                # Convert channel_num to string for the overrides dictionary
                channel_key = str(channel_num)
                
                # Set the channel override
                self.vehicle.channels.overrides[channel_key] = pwm_value
                print(f"[Drone] Successfully set channel {channel_num} to {pwm_value}")
                return True
            else:
                print(f"[Drone] Pixhawk not connected, RC channel {channel_num} set simulated")
                return False
        except Exception as e:
            print(f"[Drone] Error setting RC channel: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def control_camera_tilt(self, direction):
        """Adjust the camera tilt up or down"""
        if direction == "up":
            # Move camera upward (decrease PWM)
            new_pwm = max(self.last_pwm_value - 50, 600)  # Limit minimum PWM to 600
            return self.set_servo(9, new_pwm)
        elif direction == "down":
            # Move camera downward (increase PWM)
            new_pwm = min(self.last_pwm_value + 50, 1650)  # Limit maximum PWM to 1650
            return self.set_servo(9, new_pwm)
        return False
    
    def arm(self):
        """Arm the drone's motors"""
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't arm")
            return False
            
        try:
            print("[Drone] Arming motors")
            self.vehicle.armed = True
            print("[Drone] Waiting for arming...")
            
            # Wait for arming to complete
            start_time = time.time()
            while not self.vehicle.armed and time.time() - start_time < 10:
                time.sleep(0.5)
                
            if self.vehicle.armed:
                print("[Drone] Armed!")
                return True
            else:
                print("[Drone] Arming timed out")
                return False
        except Exception as e:
            print(f"[Drone] Error arming: {e}")
            return False
    
    def takeoff(self, altitude=2.0):
        """Command the drone to take off to the specified altitude"""
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't takeoff")
            return False
            
        try:
            if not self.vehicle.armed:
                print("[Drone] Cannot takeoff - not armed")
                return False
                
            # Set mode to GUIDED (required for takeoff)
            self.vehicle.mode = VehicleMode("GUIDED")
            # Wait for mode change
            start_time = time.time()
            while self.vehicle.mode.name != "GUIDED" and time.time() - start_time < 5:
                time.sleep(0.1)
                
            if self.vehicle.mode.name != "GUIDED":
                print("[Drone] Failed to enter GUIDED mode")
                return False
                
            # Take off to specified altitude
            self.vehicle.simple_takeoff(altitude)
            print(f"[Drone] Taking off to {altitude} meters")
            return True
        except Exception as e:
            print(f"[Drone] Error during takeoff: {e}")
            return False
    
    def land(self):
        """Command the drone to land"""
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't land")
            return False
            
        try:
            print("[Drone] Landing")
            self.vehicle.mode = VehicleMode("LAND")
            print("[Drone] Landing mode activated")
            return True
        except Exception as e:
            print(f"[Drone] Error during landing: {e}")
            return False
    
    def return_to_launch(self):
        """Command the drone to return to launch location"""
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't RTL")
            return False
            
        try:
            print("[Drone] Returning to launch")
            self.vehicle.mode = VehicleMode("RTL")
            print("[Drone] RTL mode activated")
            return True
        except Exception as e:
            print(f"[Drone] Error during RTL: {e}")
            return False
    
    def goto(self, lat, lon, alt):
        """Command the drone to go to a specific global location"""
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't goto")
            return False
            
        try:
            print(f"[Drone] Going to: Lat {lat}, Lon {lon}, Alt {alt}")
            
            # Set to GUIDED mode if needed
            if self.vehicle.mode.name != "GUIDED":
                self.vehicle.mode = VehicleMode("GUIDED")
                # Wait for mode change
                timeout = 5
                start = time.time()
                while self.vehicle.mode.name != "GUIDED" and time.time() - start < timeout:
                    time.sleep(0.1)
            
            # Create target location
            target_location = LocationGlobalRelative(lat, lon, alt)
            
            # Send drone to target location
            self.vehicle.simple_goto(target_location)
            print(f"[Drone] Sent goto command to: {target_location}")
            return True
        except Exception as e:
            print(f"[Drone] Error during goto: {e}")
            return False
    
    def move_relative(self, forward, right, down):
        """
        Move drone relative to its current position and heading
        
        Args:
            forward (float): Forward distance in meters (negative for backward)
            right (float): Right distance in meters (negative for left)
            down (float): Down distance in meters (negative for up)
        
        Returns:
            bool: Success of the operation
        """
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't move relative")
            return False
            
        try:
            # Get current location
            current = self.vehicle.location.global_relative_frame
            
            # Get current heading
            heading = self.vehicle.heading or 0
            heading_rad = math.radians(heading)
            
            # Convert NED (North, East, Down) coordinates to lat/lon
            # These conversion factors are approximate and depend on location
            METERS_PER_LAT = 111320  # meters per degree latitude
            METERS_PER_LON = 111320 * math.cos(math.radians(current.lat))  # meters per degree longitude
            
            # Calculate offsets
            # Rotate the forward/right values based on heading
            north_offset = forward * math.cos(heading_rad) - right * math.sin(heading_rad)
            east_offset = forward * math.sin(heading_rad) + right * math.cos(heading_rad)
            
            # Convert to lat/lon
            lat_offset = north_offset / METERS_PER_LAT
            lon_offset = east_offset / METERS_PER_LON
            
            # Calculate new position
            new_lat = current.lat + lat_offset
            new_lon = current.lon + lon_offset
            new_alt = current.alt - down  # Decrease altitude to go up
            
            # Make sure altitude is at least 1 meter
            new_alt = max(1.0, new_alt)
            
            # Create target location
            target = LocationGlobalRelative(new_lat, new_lon, new_alt)
            
            # Set mode to GUIDED
            self.vehicle.mode = VehicleMode("GUIDED")
            
            # Send command
            self.vehicle.simple_goto(target)
            
            print(f"[Drone] Moving relative: Forward {forward}m, Right {right}m, Down {down}m")
            print(f"[Drone] New target: Lat {new_lat}, Lon {new_lon}, Alt {new_alt}")
            return True
        except Exception as e:
            print(f"[Drone] Error moving relative: {e}")
            return False
    
    def get_location(self):
        """Get the current location of the drone"""
        if not self.is_available or not self.vehicle:
            return None
            
        try:
            rel_loc = self.vehicle.location.global_relative_frame  # Altitude relative to home/takeoff
            msl_loc = self.vehicle.location.global_frame  # Altitude as MSL (Mean Sea Level)
            
            return {
                "lat": rel_loc.lat,
                "lon": rel_loc.lon,
                "rel_alt": rel_loc.alt,
                "alt": msl_loc.alt,
                "heading": self.vehicle.heading
            }
        except Exception as e:
            print(f"[Drone] Error getting location: {e}")
            return None
    
    def start_surveillance_mission(self, points, speed, altitude, style, line_spacing, buffer_zone):
        """
        Start a surveillance mission over the defined area

        Args:
            points: List of (lat, lon) tuples defining the surveillance area
            speed: Drone speed in m/s
            altitude: Surveillance altitude in meters
            style: Either "longest" or "shortest" to determine pattern orientation
            line_spacing: Distance between parallel survey lines in meters
            buffer_zone: Extra buffer around the area in meters

        Returns:
            bool: Success of the operation
        """
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't start surveillance mission")
            return False

        try:
            # Set to GUIDED mode if needed
            if self.vehicle.mode.name != "GUIDED":
                self.vehicle.mode = VehicleMode("GUIDED")
                # Wait for mode change
                timeout = 5
                start = time.time()
                while self.vehicle.mode.name != "GUIDED" and time.time() - start < timeout:
                    time.sleep(0.1)

            if not self.vehicle.armed:
                print("[Drone] WARNING: Vehicle not armed, surveillance mission may fail")

            # Calculate the surveillance path
            path = self._calculate_surveillance_path(points, speed, altitude, style, line_spacing, buffer_zone)

            if len(path) == 0:
                print("[Drone] Failed to calculate a valid surveillance path")
                return False

            # Start a thread to execute the mission
            mission_thread = threading.Thread(
                target=self._execute_surveillance_mission,
                args=(path, speed, altitude)
            )
            mission_thread.daemon = True
            mission_thread.start()

            print(f"[Drone] Surveillance mission started with {len(path)} waypoints")
            return True

        except Exception as e:
            print(f"[Drone] Error starting surveillance mission: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _calculate_surveillance_path(self, points, speed, altitude, style, line_spacing, buffer_zone):
        """
        Calculate a surveillance pattern path based on the given area and parameters

        Args:
            points: List of (lat, lon) tuples defining the surveillance area
            speed: Drone speed in m/s
            altitude: Surveillance altitude in meters
            style: Either "longest" or "shortest" to determine pattern orientation
            line_spacing: Distance between parallel survey lines in meters
            buffer_zone: Extra buffer around the area in meters

        Returns:
            list: List of (lat, lon) waypoints for the surveillance path
        """
        try:
            # Convert points to a numpy array for easier calculation
            points_array = np.array(points)

            # Calculate the centroid of the polygon
            centroid = np.mean(points_array, axis=0)
            print(f"[Drone] Area centroid: Lat {centroid[0]}, Lon {centroid[1]}")

            # Get current location to calculate distance to the area
            current_location = None
            if self.vehicle:
                loc = self.vehicle.location.global_relative_frame
                if loc:
                    current_location = (loc.lat, loc.lon)

            # Calculate the oriented bounding box of the area
            rect_points, rect_angle = self._calculate_oriented_bounding_box(points_array)

            # Add buffer zone to the bounding box
            rect_points_buffered = self._add_buffer_to_polygon(rect_points, buffer_zone)

            # Generate the surveillance pattern within the bounding box
            if style == "longest":
                # Use the longest side of the bounding box as the pattern direction
                return self._generate_parallel_pattern(rect_points_buffered, line_spacing, current_location)
            else:
                # Use the shortest side of the bounding box as the pattern direction
                # Rotate the bounding box 90 degrees
                rotated_rect = self._rotate_polygon(rect_points_buffered, 90)
                return self._generate_parallel_pattern(rotated_rect, line_spacing, current_location)

        except Exception as e:
            print(f"[Drone] Error calculating surveillance path: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _calculate_oriented_bounding_box(self, points):
        """
        Calculate the minimum oriented bounding box for a set of points

        Args:
            points: Numpy array of points shape (n, 2)

        Returns:
            tuple: (rectangle_points, angle_of_orientation)
        """
        # For simplicity, we'll use a axis-aligned bounding box for now
        # In a production system, you would implement a convex hull + minimum area rectangle algorithm

        min_lat = np.min(points[:, 0])
        max_lat = np.max(points[:, 0])
        min_lon = np.min(points[:, 1])
        max_lon = np.max(points[:, 1])

        # Create the four corners of the bounding box
        rect_points = np.array([
            [min_lat, min_lon],  # bottom-left
            [min_lat, max_lon],  # bottom-right
            [max_lat, max_lon],  # top-right
            [max_lat, min_lon]   # top-left
        ])

        # Calculate angle - in this simplified version, we're using 0 degrees
        # because we're using an axis-aligned bounding box
        angle = 0

        return rect_points, angle

    def _add_buffer_to_polygon(self, points, buffer_distance):
        """
        Add a buffer zone around a polygon

        Args:
            points: Numpy array of points shape (n, 2)
            buffer_distance: Buffer distance in meters

        Returns:
            numpy.ndarray: Buffered polygon points
        """
        # For a proper implementation, you'd use a buffer algorithm
        # For this simplified version, we'll just extend the bounding box

        # Convert buffer from meters to approximate lat/lon degrees
        # This is a very rough approximation
        lat_buffer = buffer_distance / 111320.0  # 1 degree lat is approximately 111.32 km
        lon_buffer = buffer_distance / (111320.0 * math.cos(math.radians(np.mean(points[:, 0]))))

        # Apply the buffer
        buffered_points = points.copy()
        buffered_points[0, 0] -= lat_buffer  # bottom-left lat
        buffered_points[0, 1] -= lon_buffer  # bottom-left lon
        buffered_points[1, 0] -= lat_buffer  # bottom-right lat
        buffered_points[1, 1] += lon_buffer  # bottom-right lon
        buffered_points[2, 0] += lat_buffer  # top-right lat
        buffered_points[2, 1] += lon_buffer  # top-right lon
        buffered_points[3, 0] += lat_buffer  # top-left lat
        buffered_points[3, 1] -= lon_buffer  # top-left lon

        return buffered_points

    def _rotate_polygon(self, points, angle_degrees):
        """
        Rotate a polygon around its centroid

        Args:
            points: Numpy array of points shape (n, 2)
            angle_degrees: Rotation angle in degrees

        Returns:
            numpy.ndarray: Rotated polygon points
        """
        # Calculate centroid
        centroid = np.mean(points, axis=0)

        # Convert angle to radians
        angle_rad = math.radians(angle_degrees)

        # Create rotation matrix
        rot_matrix = np.array([
            [math.cos(angle_rad), -math.sin(angle_rad)],
            [math.sin(angle_rad), math.cos(angle_rad)]
        ])

        # Translate points to origin, rotate, and translate back
        centered_points = points - centroid
        rotated_points = np.dot(centered_points, rot_matrix.T)
        rotated_points = rotated_points + centroid

        return rotated_points

    def _generate_parallel_pattern(self, rect_points, line_spacing, current_location=None):
        """
        Generate a parallel line pattern for surveillance

        Args:
            rect_points: Numpy array of rectangle points shape (4, 2)
            line_spacing: Spacing between lines in meters
            current_location: Optional tuple (lat, lon) of current drone location

        Returns:
            list: List of (lat, lon) waypoints for the surveillance path
        """
        # Convert line spacing from meters to lat/lon degrees
        avg_lat = np.mean(rect_points[:, 0])
        lat_spacing = line_spacing / 111320.0  # 1 degree lat is approximately 111.32 km
        lon_spacing = line_spacing / (111320.0 * math.cos(math.radians(avg_lat)))

        # Determine which sides are longer
        width = abs(rect_points[1, 1] - rect_points[0, 1])  # lon difference
        height = abs(rect_points[3, 0] - rect_points[0, 0])  # lat difference

        # Points will be ordered to ensure we go from the nearest point to the current location if available
        waypoints = []

        if width > height:  # If width is longer, make horizontal passes
            # Sort vertices by latitude (north-south)
            south = min(rect_points[:, 0])
            north = max(rect_points[:, 0])
            west = min(rect_points[:, 1])
            east = max(rect_points[:, 1])

            # Generate parallel lines from south to north
            current_lat = south
            go_east = True  # Start going east

            while current_lat <= north:
                if go_east:
                    waypoints.append((current_lat, west))
                    waypoints.append((current_lat, east))
                else:
                    waypoints.append((current_lat, east))
                    waypoints.append((current_lat, west))

                current_lat += lat_spacing
                go_east = not go_east  # Toggle direction

        else:  # If height is longer, make vertical passes
            # Sort vertices by longitude (east-west)
            south = min(rect_points[:, 0])
            north = max(rect_points[:, 0])
            west = min(rect_points[:, 1])
            east = max(rect_points[:, 1])

            # Generate parallel lines from west to east
            current_lon = west
            go_north = True  # Start going north

            while current_lon <= east:
                if go_north:
                    waypoints.append((south, current_lon))
                    waypoints.append((north, current_lon))
                else:
                    waypoints.append((north, current_lon))
                    waypoints.append((south, current_lon))

                current_lon += lon_spacing
                go_north = not go_north  # Toggle direction

        # Calculate nearest point to current location if available
        if current_location is not None:
            # Find the closest point to current location
            distances = []
            for i, wp in enumerate(waypoints):
                dist = self._haversine_distance(current_location[0], current_location[1], wp[0], wp[1])
                distances.append((i, dist))

            # Sort by distance
            distances.sort(key=lambda x: x[1])
            nearest_idx = distances[0][0]

            # Reorder waypoints to start from the nearest point
            waypoints = waypoints[nearest_idx:] + waypoints[:nearest_idx]

        return waypoints

    def _execute_surveillance_mission(self, waypoints, speed, altitude):
        """
        Execute a surveillance mission by visiting all waypoints

        Args:
            waypoints: List of (lat, lon) waypoints for the surveillance path
            speed: Drone speed in m/s
            altitude: Surveillance altitude in meters
        """
        if not self.is_available or not self.vehicle:
            print("[Drone] Vehicle not available, can't execute surveillance mission")
            return

        try:
            print(f"[Drone] Executing surveillance mission with {len(waypoints)} waypoints")

            # Make sure we're in GUIDED mode
            if self.vehicle.mode.name != "GUIDED":
                self.vehicle.mode = VehicleMode("GUIDED")
                time.sleep(1)

            # Execute the surveillance pattern
            for i, (lat, lon) in enumerate(waypoints):
                # Check if we're still in GUIDED mode - user might have taken control
                if self.vehicle.mode.name != "GUIDED":
                    print("[Drone] Mission aborted - no longer in GUIDED mode")
                    return

                print(f"[Drone] Moving to waypoint {i+1}/{len(waypoints)}: Lat {lat}, Lon {lon}, Alt {altitude}")

                # Create target location
                target_location = LocationGlobalRelative(lat, lon, altitude)

                # Send drone to target location
                self.vehicle.simple_goto(target_location)

                # Wait until we reach the waypoint within a certain radius or timeout
                self._wait_for_waypoint(lat, lon, timeout=60, accuracy=5.0)

            print("[Drone] Surveillance mission completed")

        except Exception as e:
            print(f"[Drone] Error executing surveillance mission: {e}")
            import traceback
            traceback.print_exc()

    def _wait_for_waypoint(self, target_lat, target_lon, timeout=60, accuracy=5.0):
        """
        Wait until the drone reaches a waypoint within a certain accuracy or timeout

        Args:
            target_lat: Target latitude
            target_lon: Target longitude
            timeout: Maximum time to wait in seconds
            accuracy: Required accuracy in meters
        """
        start_time = time.time()

        while time.time() - start_time < timeout:
            # Get current location
            current = self.vehicle.location.global_relative_frame

            # Calculate distance to target
            distance = self._haversine_distance(
                current.lat, current.lon,
                target_lat, target_lon
            )

            # If we're within the required accuracy, we've reached the waypoint
            if distance <= accuracy:
                print(f"[Drone] Reached waypoint within {distance:.2f}m")
                return True

            # Check if we're still in GUIDED mode
            if self.vehicle.mode.name != "GUIDED":
                print("[Drone] No longer in GUIDED mode, aborting waypoint wait")
                return False

            # Sleep to avoid cpu hogging
            time.sleep(0.5)

        print(f"[Drone] Waypoint timeout after {timeout} seconds")
        return False

    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        """
        Calculate the great circle distance between two points on the earth

        Args:
            lat1, lon1: First point coordinates
            lat2, lon2: Second point coordinates

        Returns:
            float: Distance in meters
        """
        # Convert decimal degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        r = 6371000  # Radius of earth in meters
        return c * r

    def cleanup(self):
        """Clean up drone control resources"""
        if self.vehicle:
            try:
                # Reset channel overrides
                if hasattr(self.vehicle.channels, 'overrides'):
                    self.vehicle.channels.overrides = {}
                    print("[Drone] Reset all RC channel overrides")

                # Close the vehicle connection
                self.vehicle.close()
                print("[Drone] Vehicle connection closed")
            except Exception as e:
                print(f"[Drone] Error during cleanup: {e}")

            self.vehicle = None
            self.is_available = False