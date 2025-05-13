#!/usr/bin/env python3
"""
communication.py
---------
Handles WebRTC and signaling for the drone control system
Manages video streams and data channel communication
"""

import asyncio
import socketio
import time
import json

from aiortc import (
    RTCPeerConnection,
    RTCConfiguration,
    RTCIceServer,
    RTCSessionDescription
)

class DataChannelManager:
    """Manages the WebRTC data channel for sending/receiving commands"""
    
    def __init__(self, drone_controller=None, camera_manager=None, led_controller=None):
        self.channel = None
        self.is_ready = False
        self.last_heartbeat_time = time.time()
        self.drone_controller = drone_controller
        self.camera_manager = camera_manager
        self.led_controller = led_controller
    
    def set_channel(self, channel):
        """Set up the data channel and its event handlers"""
        self.channel = channel
        self.is_ready = False
        
        @channel.on("open")
        def on_channel_open():
            print("[Comm] Data channel is open.")
            self.is_ready = True
        
        @channel.on("message")
        def on_channel_message(msg):
            self._process_message(msg)
        
        @channel.on("close")
        def on_channel_close():
            print("[Comm] Data channel closed.")
            self.is_ready = False
    
    def _process_message(self, msg):
        """Process incoming messages from the data channel"""
        # Handle heartbeat
        if msg == "heartbeat":
            print("[Comm] Heartbeat received.")
            self.last_heartbeat_time = time.time()
            self.channel.send("heartbeat")
            return
            
        # Handle thermal camera commands
        if msg.startswith("THERMAL_"):
            self._handle_thermal_command(msg)
            return
            
        # Handle image capture
        if msg == "CAPTURE_IMAGES":
            self._handle_capture_images()
            return
            
        # Handle video recording commands
        if msg.startswith("VIDEO_"):
            self._handle_video_command(msg)
            return
            
        # Handle PWM commands
        if msg.startswith("MANUAL_PWM:"):
            self._handle_pwm_command(msg)
            return
            
        # Handle goto command
        if msg.startswith("GOTO:"):
            self._handle_goto_command(msg)
            return

        # Handle surveillance mission
        if msg.startswith("START_SURVEILLANCE:"):
            self._handle_surveillance_command(msg)
            return

        # Handle camera tilt
        if msg.startswith("CAMERA_TILT_"):
            self._handle_camera_tilt(msg)
            return

        # Handle LED commands
        if msg.startswith("LED_"):
            self._handle_led_command(msg)
            return

        # Handle manual and auto flight control
        if msg.startswith("MANUAL_") or msg.startswith("AUTO_"):
            self._handle_flight_control(msg)
            return
            
        # Default handler for unrecognized messages
        print(f"[Comm] Received from Admin => {msg}")
    
    def _handle_thermal_command(self, msg):
        """Handle thermal camera related commands"""
        if not self.camera_manager or not self.camera_manager.is_thermal_available():
            self.channel.send("THERMAL_ERROR:Thermal camera not available")
            return
            
        thermal_camera = self.camera_manager.get_thermal_camera()
        if not thermal_camera:
            self.channel.send("THERMAL_ERROR:Thermal camera not available")
            return
            
        try:
            if msg == "THERMAL_TOGGLE_ACTIVE":
                # This command will be handled on the client side
                pass
                
            elif msg.startswith("THERMAL_COLORMAP:"):
                colormap_idx = int(msg.split(":")[1])
                thermal_camera.set_colormap(colormap_idx)
                print(f"[Comm] Thermal colormap set to {colormap_idx}")
                
            elif msg.startswith("THERMAL_CONTRAST:"):
                contrast = float(msg.split(":")[1])
                thermal_camera.set_contrast(contrast)
                print(f"[Comm] Thermal contrast set to {contrast}")
                
            elif msg.startswith("THERMAL_BLUR:"):
                blur = int(msg.split(":")[1])
                thermal_camera.set_blur(blur)
                print(f"[Comm] Thermal blur set to {blur}")
                
            elif msg.startswith("THERMAL_ROTATE:"):
                angle = int(msg.split(":")[1])
                thermal_camera.set_rotation(angle)
                print(f"[Comm] Thermal rotation set to {angle}")
                
            elif msg.startswith("THERMAL_THRESHOLD:"):
                threshold = float(msg.split(":")[1])
                thermal_camera.set_temp_threshold(threshold)
                print(f"[Comm] Thermal threshold set to {threshold}")
                
            elif msg.startswith("THERMAL_DETECT_REGIONS:"):
                detect_value = msg.split(":")[1].lower()
                detect_enabled = detect_value in ["true", "1", "on", "yes"]
                thermal_camera.set_detect_regions(detect_enabled)
                status = "enabled" if detect_enabled else "disabled"
                print(f"[Comm] Thermal region detection {status}")
                # Send confirmation back to client
                self.channel.send(f"THERMAL_DETECT_REGIONS_STATUS:{status}")
                
            elif msg.startswith("THERMAL_DETECTION_MODE:"):
                mode = msg.split(":")[1].lower()
                if mode in ["over", "under"]:
                    thermal_camera.set_detection_mode(mode)
                    print(f"[Comm] Thermal detection mode set to {mode}")
                    # Send confirmation back to client
                    self.channel.send(f"THERMAL_DETECTION_MODE_STATUS:{mode}")
            
            elif msg == "THERMAL_TOGGLE_HUD":
                # Toggle the HUD display
                if hasattr(thermal_camera, 'toggle_hud'):
                    thermal_camera.toggle_hud()
                    hud_status = "ON" if thermal_camera.show_hud else "OFF"
                    print(f"[Comm] Thermal HUD display: {hud_status}")
                    # Send confirmation back to client
                    self.channel.send(f"THERMAL_HUD_STATUS:{hud_status}")
                    
        except Exception as e:
            print(f"[Comm] Error processing thermal command {msg}: {e}")
            self.channel.send(f"THERMAL_ERROR:{str(e)}")
    
    def _handle_capture_images(self):
        """Handle image capture command"""
        print("[Comm] CAPTURE_IMAGES command received")
        
        try:
            if not self.camera_manager or not self.camera_manager.is_thermal_available():
                print("[Comm] Thermal camera not available for capture")
                self.channel.send("CAPTURE_ERROR:Thermal camera not available")
                return
                
            thermal_camera = self.camera_manager.get_thermal_camera()
            
            # Get the normal camera frame if available
            normal_frame = None
            if self.camera_manager.is_camera_available():
                normal_frame = self.camera_manager.capture_normal_frame()
            
            # Use the existing capture_images method in ThermalCamera
            result = thermal_camera.capture_images(normal_frame)
            
            if "error" in result:
                print(f"[Comm] Capture error: {result['error']}")
                self.channel.send(f"CAPTURE_ERROR:{result['error']}")
            else:
                print(f"[Comm] Images captured successfully to {result['thermal_path']}")
                self.channel.send(f"CAPTURE_SUCCESS:{result['timestamp']}")
                
        except Exception as e:
            print(f"[Comm] Error during capture: {e}")
            import traceback
            traceback.print_exc()
            self.channel.send(f"CAPTURE_ERROR:{str(e)}")

    def _handle_video_command(self, msg):
        """Handle video recording commands"""
        if not self.camera_manager:
            print("[Comm] Camera manager not available for video recording")
            self.channel.send("VIDEO_ERROR:Camera manager not available")
            return
            
        try:
            if msg.startswith("VIDEO_START"):
                # Check if we're already recording
                if self.camera_manager.is_recording():
                    print("[Comm] Already recording video")
                    self.channel.send("VIDEO_ERROR:Already recording")
                    return
                    
                # Parse thermal data FPS if provided (default to 1)
                thermal_data_fps = 1
                if ":" in msg:
                    parts = msg.split(":")
                    if len(parts) >= 2:
                        try:
                            thermal_data_fps = float(parts[1])
                            # Ensure a reasonable value (0.1 to 30 FPS)
                            thermal_data_fps = max(0.1, min(30, thermal_data_fps))
                        except ValueError:
                            print(f"[Comm] Invalid thermal data FPS value: {parts[1]}, using default 1 FPS")
                
                print(f"[Comm] Starting video recording with thermal data at {thermal_data_fps} FPS")
                result = self.camera_manager.start_video_recording(thermal_data_fps)
                
                if "error" in result:
                    self.channel.send(f"VIDEO_ERROR:{result['error']}")
                else:
                    self.channel.send(f"VIDEO_STARTED:{result['timestamp']}:{result['thermal_data_fps']}")
                    
            elif msg == "VIDEO_STOP":
                if not self.camera_manager.is_recording():
                    print("[Comm] Not recording video")
                    self.channel.send("VIDEO_ERROR:Not recording")
                    return
                    
                print("[Comm] Stopping video recording")
                result = self.camera_manager.stop_video_recording()
                
                if "error" in result:
                    self.channel.send(f"VIDEO_ERROR:{result['error']}")
                else:
                    # Send success with timestamp and frames recorded info
                    frames_info = result['frames_recorded']
                    response = (f"VIDEO_STOPPED:{result['timestamp']}:" +
                               f"{frames_info['normal']}:{frames_info['thermal']}:{frames_info['thermal_data']}")
                    self.channel.send(response)
                    
            else:
                print(f"[Comm] Unknown video command: {msg}")
                self.channel.send("VIDEO_ERROR:Unknown command")
                
        except Exception as e:
            print(f"[Comm] Error handling video command: {e}")
            import traceback
            traceback.print_exc()
            self.channel.send(f"VIDEO_ERROR:{str(e)}")
    
    def _handle_pwm_command(self, msg):
        """Handle PWM commands for RC channels"""
        try:
            # Format: MANUAL_PWM:channel:pwm_value
            parts = msg.split(":")
            if len(parts) == 3:
                channel_num = int(parts[1])
                # Handle both integer and floating point values
                try:
                    # First try converting to integer directly
                    pwm_value = int(parts[2])
                except ValueError:
                    # If that fails, try converting to float first, then to integer
                    try:
                        pwm_value = int(float(parts[2]))
                    except ValueError:
                        print(f"[Comm] Invalid PWM value: {parts[2]}")
                        return
                
                # Set the channel to the specified PWM value
                if self.drone_controller:
                    self.drone_controller.set_rc_channel(channel_num, pwm_value)
            else:
                print(f"[Comm] Invalid PWM format: {msg}")
        except Exception as e:
            print(f"[Comm] Error processing PWM command: {e}")
    
    def _handle_goto_command(self, msg):
        """Handle goto command for drone navigation"""
        try:
            # Format: GOTO:lat:lon:alt
            parts = msg.split(":")
            if len(parts) == 4:
                lat = float(parts[1])
                lon = float(parts[2])
                alt = float(parts[3])

                if self.drone_controller and self.drone_controller.is_available:
                    print(f"[Comm] Received goto command: Lat {lat}, Lon {lon}, Alt {alt}")
                    # Execute the goto command through the drone controller
                    success = self.drone_controller.goto(lat, lon, alt)

                    if success:
                        # Send confirmation back to client
                        self.channel.send(f"GOTO_STARTED:{lat}:{lon}:{alt}")
                    else:
                        self.channel.send("GOTO_ERROR:Failed to start goto command")
                else:
                    print("[Comm] DroneKit not available, cannot goto")
                    self.channel.send("GOTO_ERROR:DroneKit not available")
            else:
                print(f"[Comm] Invalid goto format: {msg}")
                self.channel.send("GOTO_ERROR:Invalid format")
        except Exception as e:
            print(f"[Comm] Error processing goto: {e}")
            self.channel.send(f"GOTO_ERROR:{str(e)}")

    def _handle_surveillance_command(self, msg):
        """Handle surveillance mission command"""
        try:
            # Format: START_SURVEILLANCE:lat1:lon1,lat2:lon2,...|speed:altitude:style:lineSpacing:bufferZone
            # Remove command prefix
            content = msg.replace("START_SURVEILLANCE:", "")

            # Split into area points and mission parameters
            parts = content.split("|")
            if len(parts) != 2:
                print(f"[Comm] Invalid surveillance format: {msg}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid format")
                return

            points_str, params_str = parts

            # Parse area points
            points_list = []
            for point in points_str.split(","):
                coords = point.split(":")
                if len(coords) != 2:
                    print(f"[Comm] Invalid point format: {point}")
                    self.channel.send("SURVEILLANCE_ERROR:Invalid point format")
                    return

                lat = float(coords[0])
                lon = float(coords[1])
                points_list.append((lat, lon))

            # Parse mission parameters
            params = params_str.split(":")
            if len(params) != 5:
                print(f"[Comm] Invalid parameters format: {params_str}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid parameters format")
                return

            speed = float(params[0])
            altitude = float(params[1])
            style = params[2]  # "longest" or "shortest"
            line_spacing = float(params[3])
            buffer_zone = float(params[4])

            # Validate parameters
            if speed < 1 or speed > 15:
                print(f"[Comm] Invalid speed: {speed}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid speed (1-15 m/s)")
                return

            if altitude < 10 or altitude > 120:
                print(f"[Comm] Invalid altitude: {altitude}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid altitude (10-120 m)")
                return

            if style not in ["longest", "shortest"]:
                print(f"[Comm] Invalid style: {style}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid style")
                return

            if line_spacing < 5 or line_spacing > 50:
                print(f"[Comm] Invalid line spacing: {line_spacing}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid line spacing (5-50 m)")
                return

            if buffer_zone < 0 or buffer_zone > 20:
                print(f"[Comm] Invalid buffer zone: {buffer_zone}")
                self.channel.send("SURVEILLANCE_ERROR:Invalid buffer zone (0-20 m)")
                return

            # Check if we have at least 3 points to define an area
            if len(points_list) < 3:
                print(f"[Comm] Not enough points for surveillance area: {len(points_list)}")
                self.channel.send("SURVEILLANCE_ERROR:Need at least 3 points to define an area")
                return

            # Execute the surveillance mission
            if self.drone_controller and self.drone_controller.is_available:
                print(f"[Comm] Starting surveillance mission with {len(points_list)} points")

                # Start the surveillance mission
                success = self.drone_controller.start_surveillance_mission(
                    points_list, speed, altitude, style, line_spacing, buffer_zone
                )

                if success:
                    # Send confirmation back to client
                    self.channel.send(f"SURVEILLANCE_STARTED:{len(points_list)}")
                else:
                    self.channel.send("SURVEILLANCE_ERROR:Failed to start mission")
            else:
                print("[Comm] DroneKit not available, cannot start surveillance")
                self.channel.send("SURVEILLANCE_ERROR:DroneKit not available")

        except Exception as e:
            print(f"[Comm] Error processing surveillance command: {e}")
            import traceback
            traceback.print_exc()
            self.channel.send(f"SURVEILLANCE_ERROR:{str(e)}")
    
    def _handle_camera_tilt(self, msg):
        """Handle camera tilt commands"""
        if msg == "CAMERA_TILT_UP":
            print("[Comm] Tilting camera UP")
            if self.drone_controller:
                self.drone_controller.control_camera_tilt("up")
        
        elif msg == "CAMERA_TILT_DOWN":
            print("[Comm] Tilting camera DOWN")
            if self.drone_controller:
                self.drone_controller.control_camera_tilt("down")
    
    def _handle_led_command(self, msg):
        """Handle LED control commands"""
        import re
        
        if msg.startswith("LED_SET_COLOR:"):
            # Extract RGB values from command (format: LED_SET_COLOR:R,G,B)
            try:
                rgb_match = re.match(r"LED_SET_COLOR:(\d+),(\d+),(\d+)", msg)
                if rgb_match and self.led_controller:
                    r, g, b = map(int, rgb_match.groups())
                    self.led_controller.set_color(r, g, b)
                else:
                    print(f"[Comm] Invalid LED color format: {msg}")
            except Exception as e:
                print(f"[Comm] Error parsing LED command: {e}")
                import traceback
                traceback.print_exc()
        
        elif msg == "LED_OFF" and self.led_controller:
            print("[Comm] Turning off LEDs")
            self.led_controller.set_color(0, 0, 0)
    
    def _handle_flight_control(self, msg):
        """Handle manual and auto flight control commands"""
        if not self.drone_controller:
            return
            
        if msg.endswith("_STOP"):
            action = msg.replace("_STOP", "")
            print(f"[Comm] Control STOPPED: {action}")
            
            # Handle control stops
            if action.startswith("MANUAL_THROTTLE"):
                self.drone_controller.set_rc_channel(3, 1500)  # Center throttle
            elif action.startswith("MANUAL_YAW"):
                self.drone_controller.set_rc_channel(4, 1500)  # Center yaw
            elif action.startswith("MANUAL_PITCH"):
                self.drone_controller.set_rc_channel(2, 1500)  # Center pitch
            elif action.startswith("MANUAL_ROLL"):
                self.drone_controller.set_rc_channel(1, 1500)  # Center roll
        else:
            # Parse the command for better display
            if msg.startswith("MANUAL_"):
                command_type = "MANUAL"
                action = msg.replace("MANUAL_", "")
                print(f"[Comm] Manual control activated: {action}")
                
                # Handle specific manual controls
                if "THROTTLE_UP" in msg:
                    self.drone_controller.set_rc_channel(3, 1700)  # Throttle up
                elif "THROTTLE_DOWN" in msg:
                    self.drone_controller.set_rc_channel(3, 1300)  # Throttle down
                elif "YAW_LEFT" in msg:
                    self.drone_controller.set_rc_channel(4, 1300)  # Yaw left
                elif "YAW_RIGHT" in msg:
                    self.drone_controller.set_rc_channel(4, 1700)  # Yaw right
                elif "PITCH_FORWARD" in msg:
                    self.drone_controller.set_rc_channel(2, 1300)  # Pitch forward
                elif "PITCH_BACKWARD" in msg:
                    self.drone_controller.set_rc_channel(2, 1700)  # Pitch backward
                elif "ROLL_LEFT" in msg:
                    self.drone_controller.set_rc_channel(1, 1300)  # Roll left
                elif "ROLL_RIGHT" in msg:
                    self.drone_controller.set_rc_channel(1, 1700)  # Roll right
                    
            elif msg.startswith("AUTO_"):
                command_type = "AUTO"
                action = msg.replace("AUTO_", "")
                print(f"[Comm] Auto command activated: {action}")
                
                # Handle specific auto commands
                if "ARM" in msg:
                    self.drone_controller.arm()
                elif "TAKEOFF" in msg:
                    self.drone_controller.takeoff()
                elif "LAND" in msg:
                    self.drone_controller.land()
                elif "RETURN_TO_LAUNCH" in msg:
                    self.drone_controller.return_to_launch()
                # Handle directional auto controls
                elif "FORWARD" in msg:
                    self.drone_controller.move_relative(2, 0, 0)  # Move 2m forward
                elif "BACKWARD" in msg:
                    self.drone_controller.move_relative(-2, 0, 0)  # Move 2m backward
                elif "LEFT" in msg:
                    self.drone_controller.move_relative(0, -2, 0)  # Move 2m left
                elif "RIGHT" in msg:
                    self.drone_controller.move_relative(0, 2, 0)  # Move 2m right
                elif "UP" in msg:
                    self.drone_controller.move_relative(0, 0, 1)  # Move 1m up
                elif "DOWN" in msg:
                    self.drone_controller.move_relative(0, 0, -1)  # Move 1m down
    
    async def monitor_heartbeat(self):
        """Periodically monitor heartbeat and send location updates"""
        while True:
            await asyncio.sleep(3)
            if self.channel and self.is_ready:
                if time.time() - self.last_heartbeat_time > 7:
                    print("[Comm] No heartbeat received for 7 seconds")
                    # Consider implementing a safety feature like RTL here
                
                # Send current location periodically if connected to vehicle
                if self.drone_controller and self.drone_controller.is_available:
                    try:
                        location = self.drone_controller.get_location()
                        if location:
                            self.channel.send(
                                f"LOCATION:{location['lat']}:{location['lon']}:{location['rel_alt']}:{location['alt']}"
                            )
                    except Exception as e:
                        print(f"[Comm] Error sending location: {e}")

class VideoStreamTrackFactory:
    """Factory for creating video stream tracks for WebRTC"""
    
    @staticmethod
    def create_normal_camera_track(camera_manager):
        """Create a video track for the regular camera"""
        from camera_manager import GlobalCameraStreamTrack
        
        camera = camera_manager.get_camera()
        if camera:
            return GlobalCameraStreamTrack(camera)
        return None
    
    @staticmethod
    def create_thermal_camera_track(camera_manager):
        """Create a video track for the thermal camera"""
        from camera_manager import ThermalCameraStreamTrack
        
        thermal_camera = camera_manager.get_thermal_camera()
        if thermal_camera:
            return ThermalCameraStreamTrack(thermal_camera)
        return None

class CommunicationManager:
    """Manages WebRTC communication with remote clients"""
    
    def __init__(self, camera_manager=None, drone_controller=None, led_controller=None):
        self.camera_manager = camera_manager
        self.drone_controller = drone_controller
        self.led_controller = led_controller
        
        # Set up Socket.IO client
        self.sio = socketio.AsyncClient()
        
        # Set up data channel manager
        self.channel_manager = DataChannelManager(
            drone_controller=drone_controller,
            camera_manager=camera_manager,
            led_controller=led_controller
        )
        
        # Configure STUN/TURN servers for WebRTC using ExpressTURN
       # In the CommunicationManager.__init__ method, update the ice_servers configuration:

        # Configure STUN/TURN servers for WebRTC using ExpressTURN
        self.ice_servers = [
            # STUN server - likely still works with this standard STUN endpoint
            RTCIceServer(urls=["stun:stun.expressturn.com:3478"]),
            # TURN server - using your assigned relay server
            RTCIceServer(
                urls=[
                    # UDP options
                    "turn:relay1.expressturn.com:3480?transport=udp",
                    # TCP options for firewall traversal
                    "turn:relay1.expressturn.com:3480?transport=tcp",
                    "turn:relay1.expressturn.com:80?transport=tcp",
                    # Secure options
                    "turns:relay1.expressturn.com:443?transport=tcp",
                    "turns:relay1.expressturn.com:5349?transport=tcp",
                ],
                username="174686931792636027",  # Replace with your ExpressTURN username
                credential="+Kc1neP2q0un1Z2OTMxU6JDKcv0=",  # Replace with your ExpressTURN password
            ),
        ]
        
        self.rtc_config = RTCConfiguration(iceServers=self.ice_servers)
        self.pc = None
        
        # Set up Socket.IO event handlers
        self._setup_socket_handlers()
    
    def _setup_socket_handlers(self):
        """Set up handlers for Socket.IO events"""
        @self.sio.event
        async def connect():
            print("[Comm] Connected to signaling server.")
            await self.create_and_send_offer()
            asyncio.create_task(self.channel_manager.monitor_heartbeat())
        
        @self.sio.event
        async def disconnect():
            print("[Comm] Disconnected from signaling server.")
        
        @self.sio.on("answer")
        async def on_answer(data):
            if not self.pc:
                return
            desc = RTCSessionDescription(sdp=data["sdp"], type=data["type"])
            await self.pc.setRemoteDescription(desc)
        
        @self.sio.on("admin-ready")
        async def on_admin_ready():
            await self.create_and_send_offer()
    
    async def create_and_send_offer(self):
        """Create and send a WebRTC offer to the signaling server"""
        if self.pc and self.pc.connectionState not in ["closed", "failed", "disconnected"]:
            print("[Comm] Closing existing peer connection before re-init.")
            await self.pc.close()
        
        self.pc = RTCPeerConnection(configuration=self.rtc_config)
        dc = self.pc.createDataChannel("chat")
        self.channel_manager.set_channel(dc)
        
        # Add regular camera track
        if self.camera_manager and self.camera_manager.is_camera_available():
            print("[Comm] Adding regular camera track to peer connection")
            video_track = VideoStreamTrackFactory.create_normal_camera_track(self.camera_manager)
            if video_track:
                video_track.set_data_channel(self.channel_manager)
                self.pc.addTrack(video_track)
            else:
                print("[Comm] WARNING: Could not create regular camera track")
        
        # Add thermal camera track if available
        try:
            if self.camera_manager and self.camera_manager.is_thermal_available():
                print("[Comm] Adding thermal camera track to peer connection")
                thermal_track = VideoStreamTrackFactory.create_thermal_camera_track(self.camera_manager)
                if thermal_track:
                    thermal_track.set_data_channel(self.channel_manager)
                    self.pc.addTrack(thermal_track)
                else:
                    print("[Comm] Could not create thermal camera track")
            else:
                print("[Comm] Thermal camera not available, skipping thermal track")
        except Exception as e:
            print(f"[Comm] Error adding thermal track: {e}")
            # Don't let thermal camera issues break the main video stream
        
        offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)
        await self.sio.emit("offer", {"type": self.pc.localDescription.type, "sdp": self.pc.localDescription.sdp})
    
    async def connect_to_server(self, server_url):
        """Connect to the signaling server"""
        try:
            await self.sio.connect(server_url)
            print(f"[Comm] Connected to signaling server at {server_url}")
            return True
        except Exception as e:
            print(f"[Comm] Failed to connect to signaling server: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the signaling server and clean up resources"""
        if self.pc:
            await self.pc.close()
            self.pc = None
        
        if self.sio.connected:
            await self.sio.disconnect()
        
        print("[Comm] Disconnected from signaling server")