# UrbanScan Drone Control Interface

This is the admin interface for the UrbanScan drone control system. It provides a web-based dashboard for remote drone operation, surveillance mission planning, and live video monitoring.

## Features

- **Live Video Streaming**: View real-time video feeds from both regular and thermal cameras
- **Drone Control**: Manual joystick control of drone movement
- **Camera Controls**: Adjust camera tilt and capture settings
- **LED Control**: Manage drone-mounted LED lighting for night operations
- **Mission Planning**: Set up autonomous surveillance missions using an interactive map
- **Telemetry Display**: Monitor drone status, battery, and position in real-time
- **Recording**: Capture and save video footage for later analysis

## Prerequisites

- Node.js 16+ and npm
- Modern browser with WebRTC support (Chrome, Firefox, Edge)
- Running signaling server (`/bothUI/signaling-server`)
- Running drone backend (`/bothUI/backend`)

## Installation

1. **Install dependencies**:
   ```bash
   cd bothUI/webrtc-admin
   npm install
   ```

2. **Configure the application**:
   
   Edit the file `src/components/Common/constants.js` to set:
   - Signaling server URL
   - Map configuration
   - Default control settings

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Usage

1. **Connection**:
   - Ensure the drone controller and signaling server are running
   - The interface will automatically connect to the drone when it comes online
   - Connection status is displayed in the status bar

2. **Video Feeds**:
   - Main panel shows camera feed (toggle between regular/thermal)
   - Adjust camera tilt using the camera control panel

3. **Flight Control**:
   - Use on-screen joysticks or keyboard controls for manual flight
   - WASD: Forward/left/back/right movement
   - Q/E: Rotate left/right
   - R/F: Up/down movement
   - Space: Emergency stop

4. **Map-Based Navigation**:
   - Click on the map to set waypoints
   - Use the mission planning tools to create surveillance patterns
   - Set mission parameters (altitude, speed, pattern)
   - Execute missions with real-time tracking

5. **LED Control**:
   - Adjust brightness and color of drone-mounted LEDs
   - Set auto or manual lighting modes

6. **Recording**:
   - Start/stop recording from the control panel
   - Download recorded videos directly from the interface

## Component Structure

- **WebRTCAdmin**: Main component organizing the interface
- **DroneFrameSender**: Manages WebRTC connections and signaling
- **Controls**: Control panels for various drone functions
  - AutoControls: Autonomous mission controls
  - ManualControls: Direct flight controls
  - CameraControls: Camera adjustment controls
  - LedPanel: LED lighting controls
  - RecordingPanel: Video recording controls
  - ThermalPanel: Thermal camera settings
- **Video**: Video display components
  - RegularVideo: Regular camera feed
  - ThermalVideo: Thermal camera feed with optional overlays
- **Map**: Interactive map for mission planning
  - MapPanel: Map display and controls
  - MapClickHandler: Processes user interactions with the map

## Development Notes

### WebRTC Connection Flow

1. Admin interface connects to signaling server
2. Drone controller connects to the same server
3. Signaling handles the exchange of WebRTC offers/answers/ICE candidates
4. Direct peer connection established between admin and drone
5. Video streams and control data flow directly between peers

### Custom Hooks

- **useWebRTC**: Manages WebRTC connection and data channels
- **useJoystick**: Handles joystick inputs and conversions
- **useElevation**: Manages elevation data for map-based planning

## Troubleshooting

### Connection Issues
- Verify that the signaling server is running
- Check the signaling server URL in constants.js
- Ensure your network allows WebRTC connections

### Video Streaming Problems
- Check that the drone cameras are properly initialized
- Verify that the WebRTC connection is established
- Try adjusting video quality settings

### Control Latency
- Prioritize control data channel for lower latency
- Reduce video quality to improve overall performance
- Check network conditions between admin and drone

## License

MIT License