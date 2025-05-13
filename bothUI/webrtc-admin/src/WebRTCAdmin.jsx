import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import process from "process";
import { Buffer } from "buffer";
import "./WebRTCAdmin.css";
import "./components/Map/MapPanel.css";

// Hooks
import { useWebRTC } from './hooks/useWebRTC';
import { useJoystick } from './hooks/useJoystick';
import { useElevation } from './hooks/useElevation';

// Components
import StatusBar from './components/UI/StatusBar';
import VideoRecordingControl from './components/UI/VideoRecordingControl';
import VideoDisplay from './components/Video/VideoDisplay';
import ManualControls from './components/Controls/ManualControls';
import AutoControls from './components/Controls/AutoControls';
import LedPanel from './components/Controls/LedPanel';
import ThermalPanel from './components/Controls/ThermalPanel';
import RecordingPanel from './components/Controls/RecordingPanel';
import CameraControls from './components/Controls/CameraControls';
import MapPanel from './components/Map/MapPanel';
import MapClickHandler from './components/Map/MapClickHandler';
import DroneFrameSender from './components/DroneFrameSender';

// Constants
import { 
  VideoDisplayMode, 
  MANUAL_CONTROLS, 
  VIDEO_START_COMMAND, 
  VIDEO_STOP_COMMAND,
  CAPTURE_COMMAND,
  MAX_ELEVATION_CACHE_SIZE
} from './components/Common/constants';

// Utils
import { hsvToRgb, limitCacheSize } from './components/Common/utils';

// Fix Leaflet default icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Polyfills for SimplePeer in the browser
window.process = process;
window.Buffer = Buffer;

const WebRTCAdmin = () => {
  // WebRTC hook
  const {
    connectionStatus,
    videoActive,
    videoDisplayMode,
    setVideoDisplayMode,
    thermalAvailable,
    peerRef,
    regularVideoRef,
    thermalVideoRef,
    sendCommand,
    activeListenersRef
  } = useWebRTC();

  // Elevation hook
  const {
    elevationCache,
    setElevationCache,
    elevationData,
    setElevationData,
    elevationLoading,
    targetAltitude,
    setTargetAltitude,
    lastValidAGL,
    setLastValidAGL,
    fetchElevation
  } = useElevation();

  // Local state
  const [controlMode, setControlMode] = useState("manual");
  const [activeKeys, setActiveKeys] = useState({});
  const [showLedPanel, setShowLedPanel] = useState(false);
  const [ledColor, setLedColor] = useState({ r: 0, g: 0, b: 0 });
  const [showThermalPanel, setShowThermalPanel] = useState(false);
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  const [thermalSettings, setThermalSettings] = useState({
    colormap: 0,
    contrast: 1.0,
    blur: 0,
    rotation: 270,
    threshold: 30,
    detectRegions: true,
    showHud: true,
    detectionMode: "over"
  });

  // Joystick hook
  const { 
    joystickConnected, 
    joystickName
  } = useJoystick(controlMode, connectionStatus, videoActive, sendCommand);

  // Heartbeat states
  const [heartbeatError, setHeartbeatError] = useState(false);
  const [lastHeartbeatTime, setLastHeartbeatTime] = useState(Date.now());
  
  // Video recording states
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoRecordingFps, setVideoRecordingFps] = useState(1);
  const [videoRecordingStatus, setVideoRecordingStatus] = useState({
    recording: false,
    timestamp: null,
    frames: {
      normal: 0,
      thermal: 0,
      thermal_data: 0
    },
    error: null
  });

  // Image capture states
  const [captureStatus, setCaptureStatus] = useState({
    capturing: false,
    lastCapture: null,
    error: null
  });

  // Drone and map states
  const [droneLocation, setDroneLocation] = useState(null);
  const [targetLocation, setTargetLocation] = useState(null);

  // Surveillance states
  const [surveillanceMode, setSurveillanceMode] = useState(false);
  const [surveillancePoints, setSurveillancePoints] = useState([]);
  const [isAreaFinalized, setIsAreaFinalized] = useState(false);

  // Refs
  const mapInstanceRef = useRef(null);
  const colorWheelRef = useRef(null);
  const intervalsRef = useRef([]);

  const handleMapClick = useCallback((e) => {
    if (connectionStatus === "connected" || videoActive) {
      const { lat, lng } = e.latlng;

      if (surveillanceMode && !isAreaFinalized) {
        // Add a new point to the surveillance area when in surveillance mode
        setSurveillancePoints(prev => [...prev, { lat, lng }]);
        console.log(`[Admin] Added surveillance point at ${lat}, ${lng}`);
      } else {
        // Regular map click handling for target location
        setTargetLocation({ lat, lng });
        fetchElevation(lat, lng);
      }
    } else {
      alert("Please connect to the drone first");
    }
  }, [connectionStatus, videoActive, fetchElevation, surveillanceMode, isAreaFinalized]);

  // Toggle functions
  const toggleControlMode = useCallback(() => {
    setControlMode(controlMode === "manual" ? "auto" : "manual");
    setShowLedPanel(false);
    setShowThermalPanel(false);
  }, [controlMode]);

  const toggleLedPanel = useCallback(() => {
    setShowLedPanel(!showLedPanel);
    setShowThermalPanel(false);
    setShowRecordingPanel(false);
  }, [showLedPanel]);

  const toggleThermalPanel = useCallback(() => {
    setShowThermalPanel(!showThermalPanel);
    setShowLedPanel(false);
    setShowRecordingPanel(false);
  }, [showThermalPanel]);

  const toggleRecordingPanel = useCallback(() => {
    setShowRecordingPanel(!showRecordingPanel);
    setShowLedPanel(false);
    setShowThermalPanel(false);
  }, [showRecordingPanel]);

  const toggleSurveillanceMode = useCallback(() => {
    if (surveillanceMode) {
      // Exiting surveillance mode, reset points and area
      setSurveillancePoints([]);
      setIsAreaFinalized(false);
    }
    setSurveillanceMode(!surveillanceMode);
  }, [surveillanceMode]);

  const finalizeArea = useCallback(() => {
    if (surveillancePoints.length < 3) {
      alert("Please add at least 3 points to create a valid area");
      return;
    }
    setIsAreaFinalized(true);

    // No message is sent here anymore - will be sent with Start Surveillance
    console.log(`[Admin] Area finalized with ${surveillancePoints.length} points`);
  }, [surveillancePoints]);

  const resetArea = useCallback(() => {
    setSurveillancePoints([]);
    setIsAreaFinalized(false);
  }, []);
  
  const toggleVideoDisplayMode = useCallback(() => {
    if (!thermalAvailable) {
      console.log("Thermal camera not available, staying in regular view mode");
      return;
    }
    
    setVideoDisplayMode(prevMode => {
      const newMode = (() => {
        switch(prevMode) {
          case VideoDisplayMode.REGULAR:
            return VideoDisplayMode.THERMAL;
          case VideoDisplayMode.THERMAL:
            return VideoDisplayMode.SIDE_BY_SIDE;
          case VideoDisplayMode.SIDE_BY_SIDE:
            return VideoDisplayMode.PICTURE_IN_PICTURE;
          case VideoDisplayMode.PICTURE_IN_PICTURE:
          default:
            return VideoDisplayMode.REGULAR;
        }
      })();
      
      console.log(`Changing video mode from ${prevMode} to ${newMode}`);
      return newMode;
    });
  }, [thermalAvailable, setVideoDisplayMode]);

// Update thermal camera settings
const updateThermalSettings = useCallback((setting, value) => {
  setThermalSettings(prev => {
    const newSettings = { ...prev, [setting]: value };
    
    if (peerRef.current && (connectionStatus === "connected" || videoActive)) {
      let command;
      
      // Format commands differently based on setting type
      switch(setting) {
        case 'rotation':
          // For rotation, send as THERMAL_ROTATE:value
          command = `THERMAL_ROTATE:${value}`;
          break;
        case 'detectRegions':
          // For detection regions, convert boolean to string
          command = `THERMAL_DETECT_REGIONS:${value ? "true" : "false"}`;
          break;
        case 'detectionMode':
          // For detection mode, format as upper case
          command = `THERMAL_DETECTION_MODE:${value.toUpperCase()}`;
          break;
        default:
          // For all other settings, use standard format
          command = `THERMAL_${setting.toUpperCase()}:${value}`;
      }
      
      console.log(`[Admin] Sending thermal command: ${command}`);
      peerRef.current.send(command);
    }
    
    return newSettings;
  });
}, [connectionStatus, videoActive, peerRef]);
  // Set LED color and send command
  const setLedColorAndSend = useCallback((r, g, b) => {
    const validR = Math.max(0, Math.min(255, Math.round(r)));
    const validG = Math.max(0, Math.min(255, Math.round(g)));
    const validB = Math.max(0, Math.min(255, Math.round(b)));
    
    console.log(`Setting LED color to RGB(${validR},${validG},${validB})`);
    setLedColor({ r: validR, g: validG, b: validB });
    sendCommand(`LED_SET_COLOR:${validR},${validG},${validB}`);
  }, [sendCommand]);

  // Handle color wheel interaction
  const handleColorWheelInteraction = useCallback((event, sendImmediately = false) => {
    if (!colorWheelRef.current) return { r: 0, g: 0, b: 0 };
    
    const rect = colorWheelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let clientX, clientY;
    if (event.type.startsWith("touch")) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    const x = clientX - rect.left - centerX;
    const y = clientY - rect.top - centerY;
    const radius = Math.sqrt(x * x + y * y);
    const maxRadius = Math.min(centerX, centerY);
    
    if (radius <= maxRadius) {
      let angle = Math.atan2(y, x);
      if (angle < 0) angle += 2 * Math.PI;
      
      let hue = ((angle + Math.PI / 2) / (2 * Math.PI)) % 1.0;
      const saturation = Math.min(1, radius / maxRadius);
      const rgb = hsvToRgb(hue, saturation, 1.0);
      
      const colorIndicator = colorWheelRef.current.querySelector(".color-indicator");
      if (colorIndicator) {
        colorIndicator.style.transform = `translate(${x}px, ${y}px)`;
      }
      
      if (sendImmediately) {
        sendCommand(`LED_SET_COLOR:${rgb.r},${rgb.g},${rgb.b}`);
      }
      
      return rgb;
    }
    
    return ledColor;
  }, [ledColor, sendCommand]);

  // Camera tilt control
  const controlCameraTilt = useCallback((direction) => {
    sendCommand(direction === "up" ? "CAMERA_TILT_UP" : "CAMERA_TILT_DOWN");
  }, [sendCommand]);

  // Handle capture images button click
  const handleCaptureImages = useCallback(() => {
    if (!peerRef.current || connectionStatus !== "connected") {
      console.error("[Admin] Cannot capture images: peer not connected");
      setCaptureStatus({
        capturing: false,
        lastCapture: null,
        error: "Not connected to drone"
      });
      return;
    }
    
    console.log("[Admin] Setting capture status to capturing");
    setCaptureStatus({
      capturing: true,
      lastCapture: null,
      error: null
    });
    
    const safeguardTimeout = setTimeout(() => {
      console.log("[Admin] Capture safeguard timeout triggered");
      setCaptureStatus(prev => {
        if (prev.capturing) {
          return {
            capturing: false,
            lastCapture: null,
            error: "Capture timeout - no response from drone"
          };
        }
        return prev;
      });
    }, 10000);
    
    window.captureSafeguardTimeout = safeguardTimeout;
    
    console.log("[Admin] Sending capture images command");
    sendCommand(CAPTURE_COMMAND);
  }, [connectionStatus, sendCommand, peerRef]);

  // Handle video recording toggle
  const handleVideoRecording = useCallback(() => {
    if (!peerRef.current || connectionStatus !== "connected") {
      console.error("[Admin] Cannot record video: peer not connected");
      setVideoRecordingStatus(prev => ({
        ...prev,
        error: "Not connected to drone"
      }));
      return;
    }
    
    if (videoRecording) {
      console.log("[Admin] Stopping video recording");
      sendCommand(VIDEO_STOP_COMMAND);
    } else {
      console.log(`[Admin] Starting video recording with ${videoRecordingFps} FPS for thermal data`);
      sendCommand(`${VIDEO_START_COMMAND}:${videoRecordingFps}`);
      
      setVideoRecordingStatus(prev => ({
        ...prev,
        recording: true,
        error: null
      }));
    }
  }, [connectionStatus, videoRecording, videoRecordingFps, sendCommand, peerRef]);

  // Create memoized map
  const memoizedMap = useMemo(() => {
    if (!showMap) return null;

    return (
      <MapContainer
        center={droneLocation ? [droneLocation.lat, droneLocation.lon] : [0, 0]}
        zoom={16}
        style={{ width: "100%", height: "400px" }}
        whenCreated={(mapInstance) => {
          mapInstanceRef.current = mapInstance;
        }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        />
        <MapClickHandler handleMapClick={handleMapClick} />

        {/* Draw lines between surveillance points */}
        {surveillanceMode && surveillancePoints.length > 1 && (
          <Polyline
            positions={surveillancePoints.map(point => [point.lat, point.lng])}
            color="red"
            weight={3}
          />
        )}

        {/* Connect last point to first point if area is finalized */}
        {surveillanceMode && isAreaFinalized && surveillancePoints.length > 2 && (
          <Polygon
            positions={surveillancePoints.map(point => [point.lat, point.lng])}
            pathOptions={{ color: 'red', fillColor: 'rgba(255, 0, 0, 0.2)', fillOpacity: 0.3 }}
          />
        )}
        {droneLocation && (
          <Marker position={[droneLocation.lat, droneLocation.lon]}>
            <Popup>
              <strong>Drone Position</strong>
              <br />
              Lat: {droneLocation.lat.toFixed(6)}
              <br />
              Lon: {droneLocation.lon.toFixed(6)}
              <br />
              Altitude: {droneLocation.alt.toFixed(1)} m
              {droneLocation.groundElevation !== undefined && (
                <>
                  <br />
                  Ground Elevation: {droneLocation.groundElevation.toFixed(1)} m
                  <br />
                  Height Above Ground: {droneLocation.heightAboveGround.toFixed(1)} m
                </>
              )}
            </Popup>
          </Marker>
        )}
        {targetLocation && !surveillanceMode && (
          <Marker
            position={[targetLocation.lat, targetLocation.lng]}
            icon={new L.Icon({
              iconUrl:
                "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
              shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            })}
          >
            <Popup>
              <strong>Target Location</strong>
              <br />
              Lat: {targetLocation.lat.toFixed(6)}
              <br />
              Lon: {targetLocation.lng.toFixed(6)}
              <br />
              Ground Elevation:{" "}
              {elevationLoading
                ? "Loading..."
                : elevationData
                ? `${elevationData.elevation} m`
                : "Unknown"}
              <br />
              Target Alt: {targetAltitude} m
              <br />
              {elevationData && (
                <span>
                  Height Above Ground: {(targetAltitude - elevationData.elevation).toFixed(1)} m
                </span>
              )}
              {droneLocation && elevationData && (
                <>
                  <br />
                  <strong>Navigation Data:</strong>
                  <br />
                  Alt Diff: {(targetAltitude - droneLocation.alt).toFixed(1)} m
                  {droneLocation.groundElevation !== undefined && (
                    <> | Ground Diff: {(elevationData.elevation - droneLocation.groundElevation).toFixed(1)} m</>
                  )}
                </>
              )}
            </Popup>
          </Marker>
        )}
        {/* Render surveillance points as green markers */}
        {surveillanceMode && surveillancePoints.map((point, index) => (
          <Marker
            key={`surv-point-${index}`}
            position={[point.lat, point.lng]}
            icon={new L.Icon({
              iconUrl:
                "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
              shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            })}
          >
            <Popup>
              <strong>Surveillance Point {index + 1}</strong>
              <br />
              Lat: {point.lat.toFixed(6)}
              <br />
              Lon: {point.lng.toFixed(6)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    );
  }, [
    showMap,
    droneLocation,
    targetLocation,
    elevationData,
    targetAltitude,
    elevationLoading,
    handleMapClick,
    surveillanceMode,
    surveillancePoints,
    isAreaFinalized
  ]);

  // Effects
  // Make sure listener is added when peer connection is established
useEffect(() => {
  const setupDataListener = () => {
    if (peerRef.current && !activeListenersRef.current.dataListener) {
      console.log("[Admin] Setting up initial data listener");
      
      const handleDataMessage = (data) => {
        const msg = data.toString();
        console.log("[Admin] Received message:", msg);
        
        // Handle all message types here
        if (msg === "heartbeat") {
          setLastHeartbeatTime(Date.now());
          return;
        }
        
        if (msg.startsWith("CAPTURE_SUCCESS:")) {
          const timestamp = msg.split(":")[1];
          console.log(`[Admin] Image capture successful at ${timestamp}`);
          
          if (window.captureSafeguardTimeout) {
            clearTimeout(window.captureSafeguardTimeout);
            window.captureSafeguardTimeout = null;
          }
          
          setCaptureStatus({
            capturing: false,
            lastCapture: timestamp,
            error: null
          });
        }
        
        if (msg.startsWith("VIDEO_STARTED:")) {
          const parts = msg.split(":");
          if (parts.length >= 2) {
            const timestamp = parts[1];
            console.log(`[Admin] Video recording started at ${timestamp}`);
            setVideoRecordingStatus({
              recording: true,
              timestamp: timestamp,
              frames: { normal: 0, thermal: 0, thermal_data: 0 },
              error: null
            });
            setVideoRecording(true);
          }
        }
        
        if (msg.startsWith("VIDEO_STOPPED:")) {
          console.log("[Admin] Video recording stopped");
          setVideoRecordingStatus(prev => ({
            ...prev,
            recording: false
          }));
          setVideoRecording(false);
        }
      };
      
      peerRef.current.on('data', handleDataMessage);
      activeListenersRef.current.dataListener = handleDataMessage;
    }
  };

  // Check immediately if connection is already established
  if (connectionStatus === "connected") {
    setupDataListener();
  }

  // Also listen for connection changes
  const checkConnectionInterval = setInterval(() => {
    if (connectionStatus === "connected") {
      setupDataListener();
    }
  }, 1000);

  return () => {
    clearInterval(checkConnectionInterval);
  };
}, [connectionStatus]);
  useEffect(() => {
    if (videoActive) {
      console.log("[Admin] Video stream is active, ensuring connection status is correct");
      setLastHeartbeatTime(Date.now());
      setHeartbeatError(false);
    }
  }, [videoActive]);

  useEffect(() => {
    if (showMap) {
      console.log("[Admin] Map panel opened");
    } else {
      if (!targetLocation) setElevationData(null);

      // Reset surveillance mode when hiding the map
      setSurveillanceMode(false);
      setSurveillancePoints([]);
      setIsAreaFinalized(false);

      if (mapInstanceRef.current) {
        console.log("[Admin] Cleaning up map instance when hiding");
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.stopLocate();

        mapInstanceRef.current.off();
        mapInstanceRef.current._handlers.forEach(handler => {
          handler.disable();
        });
      }
    }
  }, [showMap, targetLocation, setElevationData]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        console.log("[Admin] Completely cleaning up map");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (controlMode !== "manual") return;
      if (activeKeys[event.key]) return;
      
      const control = MANUAL_CONTROLS.find((ctrl) => ctrl.key === event.key);
      if (control) {
        event.preventDefault();
        setActiveKeys((prev) => ({ ...prev, [event.key]: true }));
        
        if (peerRef.current && (connectionStatus === "connected" || videoActive)) {
          console.log(`[Admin] Sending keyboard command: ${control.command}`);
          peerRef.current.send(control.command);
        } else {
          console.warn(`[Admin] Can't send keyboard command - not connected`);
        }
      }
    };
    
    const handleKeyUp = (event) => {
      if (controlMode !== "manual") return;
      
      const control = MANUAL_CONTROLS.find((ctrl) => ctrl.key === event.key);
      if (control) {
        event.preventDefault();
        setActiveKeys((prev) => ({ ...prev, [event.key]: false }));
        
        if (peerRef.current && (connectionStatus === "connected" || videoActive)) {
          console.log(`[Admin] Sending keyboard STOP command: ${control.command}_STOP`);
          peerRef.current.send(`${control.command}_STOP`);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [controlMode, connectionStatus, videoActive, activeKeys, peerRef]);

  // Heartbeat handling
  useEffect(() => {
    const currentInterval = intervalsRef.current.heartbeatSend;
    if (currentInterval) {
      clearInterval(currentInterval);
    }
    
    const interval = setInterval(() => {
      if (connectionStatus === "connected" && peerRef.current) {
        peerRef.current.send("heartbeat");
      }
    }, 5000);
    
    intervalsRef.current.heartbeatSend = interval;
    
    return () => {
      clearInterval(interval);
      intervalsRef.current.heartbeatSend = null;
    };
  }, [connectionStatus, peerRef]);

  useEffect(() => {
    const currentInterval = intervalsRef.current.heartbeatCheck;
    if (currentInterval) {
      clearInterval(currentInterval);
    }
    
    const checkInterval = setInterval(() => {
      if (videoActive) {
        setHeartbeatError(false);
        return;
      }
      
      if (Date.now() - lastHeartbeatTime > 5000) {
        setHeartbeatError(true);
      } else {
        setHeartbeatError(false);
      }
    }, 300);
    
    intervalsRef.current.heartbeatCheck = checkInterval;
    
    return () => {
      clearInterval(checkInterval);
      intervalsRef.current.heartbeatCheck = null;
    };
  }, [lastHeartbeatTime, videoActive]);
// Add this useEffect inside WebRTCAdmin component
  // Handle video freezing recovery
  useEffect(() => {
    const checkVideoHealth = () => {
      if (videoActive) {
        if (regularVideoRef.current) {
          const video = regularVideoRef.current;
          // Check if video is stuck
          if (video.srcObject && video.readyState > 2 && video.paused) {
            console.log("[Admin] Regular video appears stuck, attempting recovery");
            video.play().catch(err => console.error("[Admin] Failed to restart regular video:", err));
          }
        }
        
        if (thermalAvailable && thermalVideoRef.current) {
          const video = thermalVideoRef.current;
          // Check if thermal video is stuck
          if (video.srcObject && video.readyState > 2 && video.paused) {
            console.log("[Admin] Thermal video appears stuck, attempting recovery");
            video.play().catch(err => console.error("[Admin] Failed to restart thermal video:", err));
          }
        }
      }
    };

    // Check video health every 5 seconds
    const healthCheckInterval = setInterval(checkVideoHealth, 5000);

    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [videoActive, thermalAvailable]);
// Handle drone location messages and update state
useEffect(() => {
  const handleLocationMessage = async (msg) => {
    if (!msg.startsWith("LOCATION:")) return;
    
    try {
      const parts = msg.split(":");
      if (parts.length !== 5) return;
      
      const lat = parseFloat(parts[1]);
      const lon = parseFloat(parts[2]);
      const relAlt = parseFloat(parts[3]);
      const mslAlt = parseFloat(parts[4]);
      
      if (isNaN(lat) || isNaN(lon) || isNaN(relAlt) || isNaN(mslAlt)) return;
      
      const currentLocation = { lat, lon, alt: relAlt, mslAlt };
      
      try {
        if (
          !droneLocation ||
          Math.abs(droneLocation.lat - lat) > 0.0001 ||
          Math.abs(droneLocation.lon - lon) > 0.0001
        ) {
          console.log("[Admin] Fetching ground elevation for drone position");
          
          const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
          if (elevationCache[cacheKey]) {
            const groundElevation = elevationCache[cacheKey].elevation;
            currentLocation.groundElevation = groundElevation;
            currentLocation.heightAboveGround = mslAlt - groundElevation;
            setLastValidAGL(currentLocation.heightAboveGround);
            console.log(`[Admin] Using cached ground elevation: ${groundElevation.toFixed(1)}m`);
          } else {
            const response = await fetch(
              `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`
            );
            const data = await response.json();
            
            if (data && data.results && data.results.length > 0) {
              const groundElevation = data.results[0].elevation;
              currentLocation.groundElevation = groundElevation;
              currentLocation.heightAboveGround = mslAlt - groundElevation;
              setLastValidAGL(currentLocation.heightAboveGround);
              
              setElevationCache(prevCache => {
                const newCache = { 
                  ...prevCache, 
                  [cacheKey]: { elevation: groundElevation, lat, lng: lon } 
                };
                return limitCacheSize(newCache, MAX_ELEVATION_CACHE_SIZE);
              });
            }
          }
        } else if (droneLocation && droneLocation.groundElevation) {
          currentLocation.groundElevation = droneLocation.groundElevation;
          currentLocation.heightAboveGround = mslAlt - currentLocation.groundElevation;
          setLastValidAGL(currentLocation.heightAboveGround);
        }
      } catch (elevError) {
        console.error("[Admin] Error fetching ground elevation:", elevError);
        if (droneLocation && droneLocation.groundElevation) {
          currentLocation.groundElevation = droneLocation.groundElevation;
          currentLocation.heightAboveGround = mslAlt - currentLocation.groundElevation;
        }
      }
      
      setDroneLocation(currentLocation);
    } catch (e) {
      console.error("[Admin] Error parsing location:", e);
    }
  };

  const handleOtherMessages = (msg) => {
    console.log("[Admin] Received message:", msg); // Debug log for all messages
    
    // Handle heartbeat
    if (msg === "heartbeat") {
      setLastHeartbeatTime(Date.now());
      return;
    }
    
    // Handle capture messages
    if (msg.startsWith("CAPTURE_SUCCESS:")) {
      const timestamp = msg.split(":")[1];
      console.log(`[Admin] Image capture successful at ${timestamp}`);
      
      if (window.captureSafeguardTimeout) {
        clearTimeout(window.captureSafeguardTimeout);
        window.captureSafeguardTimeout = null;
      }
      
      setCaptureStatus({
        capturing: false,
        lastCapture: timestamp,
        error: null
      });
      return;
    }
    
    if (msg.startsWith("CAPTURE_ERROR:")) {
      const errorMsg = msg.substring("CAPTURE_ERROR:".length);
      console.error(`[Admin] Image capture error: ${errorMsg}`);
      
      if (window.captureSafeguardTimeout) {
        clearTimeout(window.captureSafeguardTimeout);
        window.captureSafeguardTimeout = null;
      }
      
      setCaptureStatus({
        capturing: false,
        lastCapture: null,
        error: errorMsg
      });
      return;
    }

    // Handle video recording messages
    if (msg.startsWith("VIDEO_STARTED:")) {
      const parts = msg.split(":");
      if (parts.length >= 2) {
        const timestamp = parts[1];
        const actualFps = parts.length >= 3 ? parseFloat(parts[2]) : videoRecordingFps;
        
        console.log(`[Admin] Video recording started at ${timestamp} with ${actualFps} FPS`);
        setVideoRecordingStatus({
          recording: true,
          timestamp: timestamp,
          frames: { normal: 0, thermal: 0, thermal_data: 0 },
          error: null
        });
        setVideoRecording(true);
      }
      return;
    }
    
    if (msg.startsWith("VIDEO_STOPPED:")) {
      const parts = msg.split(":");
      if (parts.length >= 5) {
        const timestamp = parts[1];
        const normalFrames = parseInt(parts[2], 10);
        const thermalFrames = parseInt(parts[3], 10);
        const thermalDataFrames = parseInt(parts[4], 10);
        
        console.log(`[Admin] Video recording stopped at ${timestamp}`);
        
        setVideoRecordingStatus({
          recording: false,
          timestamp: timestamp,
          frames: {
            normal: normalFrames,
            thermal: thermalFrames,
            thermal_data: thermalDataFrames
          },
          error: null
        });
        setVideoRecording(false);
      }
      return;
    }
    
    if (msg.startsWith("VIDEO_ERROR:")) {
      const errorMsg = msg.substring("VIDEO_ERROR:".length);
      console.error(`[Admin] Video recording error: ${errorMsg}`);
      
      setVideoRecordingStatus(prev => ({
        ...prev,
        recording: false,
        error: errorMsg
      }));
      setVideoRecording(false);
      return;
    }

    // Handle thermal status messages
    if (msg.startsWith("THERMAL_DETECT_REGIONS_STATUS:")) {
      const status = msg.split(":")[1];
      setThermalSettings(prev => ({
        ...prev, 
        detectRegions: status === "enabled"
      }));
      console.log(`[Admin] Thermal region detection status: ${status}`);
      return;
    }
    
    if (msg.startsWith("THERMAL_DETECTION_MODE_STATUS:")) {
      const mode = msg.split(":")[1];
      setThermalSettings(prev => ({
        ...prev, 
        detectionMode: mode
      }));
      console.log(`[Admin] Thermal detection mode status: ${mode}`);
      return;
    }
  };

  const handleDataMessage = (data) => {
    const msg = data.toString();
    handleLocationMessage(msg);
    handleOtherMessages(msg);
  };

  // Set up data listener on the peer connection
  if (peerRef.current) {
    console.log("[Admin] Adding data listener to peer connection");
    
    // Remove any existing data listener first
    if (activeListenersRef.current.dataListener) {
      peerRef.current.removeListener('data', activeListenersRef.current.dataListener);
    }
    
    // Add new data listener
    peerRef.current.on('data', handleDataMessage);
    activeListenersRef.current.dataListener = handleDataMessage;
  }

  return () => {
    if (peerRef.current && activeListenersRef.current.dataListener) {
      peerRef.current.removeListener('data', activeListenersRef.current.dataListener);
      activeListenersRef.current.dataListener = null;
    }
  };
}, [
  droneLocation, 
  elevationCache,
  setElevationCache,
  setLastValidAGL,
  videoRecordingFps,
  setVideoRecording,
  setVideoRecordingStatus,
  setCaptureStatus,
  setThermalSettings,
  connectionStatus,
  videoActive
]);

  return (
    <div className="webrtc-admin">
      <StatusBar
        connectionStatus={connectionStatus}
        heartbeatError={heartbeatError}
        joystickConnected={joystickConnected}
        joystickName={joystickName}
        captureStatus={captureStatus}
        videoRecording={videoRecording}
        videoRecordingStatus={videoRecordingStatus}
        droneLocation={droneLocation}
        lastValidAGL={lastValidAGL}
        handleVideoRecording={handleVideoRecording}
      >
        <button className="mode-toggle" onClick={toggleControlMode}>
          {controlMode === "manual" ? "MANUAL MODE" : "AUTO MODE"}
        </button>
        <button className="led-toggle" onClick={toggleLedPanel}>
          LED CONTROL
        </button>
        <button className="map-toggle" onClick={() => setShowMap(!showMap)}>
          {showMap ? "HIDE MAP" : "SHOW MAP"}
        </button>
        {videoActive && (
          <>
            {thermalAvailable && (
              <button className="thermal-toggle" onClick={toggleThermalPanel}>
                THERMAL SETTINGS
              </button>
            )}
            <button className="video-mode-toggle" onClick={toggleVideoDisplayMode} disabled={!thermalAvailable}>
              {videoDisplayMode === VideoDisplayMode.REGULAR ? "REGULAR VIEW" :
               videoDisplayMode === VideoDisplayMode.THERMAL ? "THERMAL VIEW" :
               videoDisplayMode === VideoDisplayMode.SIDE_BY_SIDE ? "SIDE BY SIDE" : "PIP VIEW"}
              {!thermalAvailable && " (Thermal N/A)"}
            </button>
            <button
              className={`capture-button ${captureStatus.capturing ? 'capturing' : ''}`}
              onClick={handleCaptureImages}
              disabled={!videoActive || captureStatus.capturing}
            >
              {captureStatus.capturing ? "CAPTURING..." : "CAPTURE IMAGES"}
            </button>
            <VideoRecordingControl
              videoActive={videoActive}
              videoRecording={videoRecording}
              videoRecordingStatus={videoRecordingStatus}
              toggleRecordingPanel={toggleRecordingPanel}
            />
            {videoActive && (
              <DroneFrameSender
                regularVideoRef={regularVideoRef}
                thermalVideoRef={thermalVideoRef}
                connectionStatus={connectionStatus}
                thermalAvailable={thermalAvailable}
                sendCommand={sendCommand}
                droneLocation={droneLocation}
                isInTopBar={true}
              />
            )}
          </>
        )}
      </StatusBar>
      <VideoDisplay
        videoDisplayMode={videoDisplayMode}
        videoActive={videoActive}
        thermalAvailable={thermalAvailable}
        regularVideoRef={regularVideoRef}
        thermalVideoRef={thermalVideoRef}
      />
      <ThermalPanel
        showThermalPanel={showThermalPanel}
        toggleThermalPanel={toggleThermalPanel}
        thermalSettings={thermalSettings}
        updateThermalSettings={updateThermalSettings}
        connectionStatus={connectionStatus}
        videoActive={videoActive}
        peerRef={peerRef}
      />
      <RecordingPanel
        showRecordingPanel={showRecordingPanel}
        toggleRecordingPanel={toggleRecordingPanel}
        videoRecordingFps={videoRecordingFps}
        setVideoRecordingFps={setVideoRecordingFps}
        handleVideoRecording={handleVideoRecording}
        videoActive={videoActive}
      />
      <LedPanel
        showLedPanel={showLedPanel}
        toggleLedPanel={toggleLedPanel}
        ledColor={ledColor}
        setLedColor={setLedColor}
        setLedColorAndSend={setLedColorAndSend}
        colorWheelRef={colorWheelRef}
        handleColorWheelInteraction={handleColorWheelInteraction}
      />
      <MapPanel
        showMap={showMap}
        toggleShowMap={() => setShowMap(!showMap)}
        droneLocation={droneLocation}
        targetLocation={targetLocation}
        elevationData={elevationData}
        targetAltitude={targetAltitude}
        setTargetAltitude={setTargetAltitude}
        elevationLoading={elevationLoading}
        handleMapClick={handleMapClick}
        connectionStatus={connectionStatus}
        videoActive={videoActive}
        peerRef={peerRef}
        memoizedMap={memoizedMap}
        mapInstanceRef={mapInstanceRef}
        surveillanceMode={surveillanceMode}
        setSurveillanceMode={setSurveillanceMode}
        toggleSurveillanceMode={toggleSurveillanceMode}
        surveillancePoints={surveillancePoints}
        isAreaFinalized={isAreaFinalized}
        finalizeArea={finalizeArea}
        resetArea={resetArea}
      />
      <CameraControls controlCameraTilt={controlCameraTilt} />
      <div className="controls-overlay">
        {controlMode === "manual" ? (
          <ManualControls 
            activeKeys={activeKeys} 
            sendCommand={sendCommand} 
          />
        ) : (
          <AutoControls sendCommand={sendCommand} />
        )}
      </div>
      
      {/* DroneFrameSender is now in the top bar */}
    </div>
  );
};

export default WebRTCAdmin;