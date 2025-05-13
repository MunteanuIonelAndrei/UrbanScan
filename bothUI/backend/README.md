# UrbanScan Drone Control System

This component of the UrbanScan project handles the drone control operations, connecting to a Pixhawk flight controller and providing various services including camera management, LED control, and WebRTC communication.

## System Overview

The drone control system is designed to run on a Raspberry Pi connected to:
- Pixhawk flight controller (via serial)
- Regular and thermal cameras (via CSI/USB)
- LED light system (optional)

It communicates with the WebRTC admin interface through a signaling server to provide:
- Live video streaming
- Remote drone control
- Autonomous mission capabilities
- Status telemetry and feedback

## Requirements

### Hardware
- Raspberry Pi 4 (recommended) with Raspbian/Ubuntu
- Pixhawk flight controller
- Regular camera (Raspberry Pi Camera or USB webcam)
- Thermal camera (compatible with Python)
- LED light system (optional)

### Software
- Python 3.9+
- DroneKit-Python library
- OpenCV
- PyAV (for camera encoding)
- aiortc (for WebRTC)
- NumPy

## Installation

1. **Set up the Raspberry Pi**:
   ```bash
   # Clone the repository
   git clone https://github.com/your-username/urbanscan.git
   cd urbanscan/bothUI/backend
   
   # Install system dependencies
   sudo apt update
   sudo apt install -y python3-pip python3-opencv python3-dev libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev
   
   # Install Python dependencies
   pip3 install -r requirements.txt
   ```

2. **Set up the Pixhawk connection**:
   ```bash
   # Create a symbolic link for the Pixhawk serial connection
   sudo ln -s /dev/ttyACM0 /dev/drona  # Adjust if your Pixhawk is on a different port
   sudo chmod 666 /dev/drona
   ```

## Configuration

The system has several configurable parameters:

### 1. Camera Configuration

Edit the `camera_manager.py` file to adjust camera settings:
- Resolution
- Framerate
- Camera types and indices
- Image processing parameters

### 2. Drone Control Parameters

Edit the `drone_control.py` file to adjust:
- Connection settings
- Flight parameters
- Servo configurations
- Safety limits

### 3. WebRTC Connection

Edit the `communication.py` file to set:
- Signaling server URL
- ICE servers (STUN/TURN)
- Video encoding parameters

## Usage

### Starting the System

```bash
# Run the main script
python main.py
```

This will:
1. Initialize the LED controller (if available)
2. Start the camera manager
3. Connect to the Pixhawk
4. Connect to the signaling server
5. Begin listening for WebRTC connections

### Manual Operation

While the system is primarily designed for remote operation via WebRTC, you can also interact with it directly:

```python
# Example: Manual control through Python
from drone_control import DroneController

# Initialize the controller
drone = DroneController()

# Control the drone
drone.arm()
drone.takeoff(2.0)  # Take off to 2 meters
drone.goto(37.7749, -122.4194, 10)  # Fly to coordinates at 10m altitude
drone.land()
```

## Component Overview

### 1. `main.py`
The entry point that initializes all components and manages the main event loop.

### 2. `communication.py`
Handles WebRTC communication with the admin interface, including signaling, video streaming, and command processing.

### 3. `drone_control.py`
Interfaces with the Pixhawk flight controller via DroneKit to provide flight control capabilities.

### 4. `camera_manager.py`
Manages both regular and thermal cameras, handles frame capturing, processing, and encoding for WebRTC.

### 5. `led_controller.py`
Controls LED lighting systems attached to the drone for night operations or visual signaling.

### 6. `thermal_camera.py`
Specific utilities for thermal camera processing and visualization.

### 7. `utils.py`
Various utility functions used across the system.

## Safety Features

The drone control system includes several safety features:
- Automatic failsafe if connection is lost
- Command validation to prevent unsafe operations
- Altitude and distance limitations
- Status monitoring and automatic return-to-home if necessary

## Troubleshooting

### Connection Issues with Pixhawk
- Check that the Pixhawk is powered and connected to the Raspberry Pi
- Verify the `/dev/drona` symlink exists and points to the correct port
- Ensure the connection settings in `drone_control.py` match your setup

### Camera Problems
- Check that cameras are properly connected and powered
- Verify camera indices in `camera_manager.py`
- Run `v4l2-ctl --list-devices` to see available cameras

### WebRTC Issues
- Verify the signaling server is running and accessible
- Check the signaling server URL in `main.py`
- Ensure the network allows the required connections (UDP for WebRTC)

## License

MIT License