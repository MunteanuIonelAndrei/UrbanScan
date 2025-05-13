import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Typography } from '@mui/material';
import './DroneMonitor.css';

// DroneMonitor component for displaying drone frames
const DroneMonitor = () => {
  const [droneFrames, setDroneFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [dialogImageType, setDialogImageType] = useState('regular');
  
  const wsRef = useRef(null);
  
  // Connect to the WebSocket for drone frames
  useEffect(() => {
    console.log('Connecting to drone frames WebSocket...');

    const MAX_RECONNECT_ATTEMPTS = 5;
    const INITIAL_RECONNECT_DELAY = 2000;
    const MAX_RECONNECT_DELAY = 30000;

    let reconnectAttempts = 0;
    let reconnectTimeout = null;
    let heartbeatInterval = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY;
    let isActive = true; // Track if component is active

    // Connect to the correct WebSocket endpoint in your backend
    const connectWebSocket = () => {
      // Don't reconnect if max attempts reached or component unmounted
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS || !isActive) {
        console.log(`Reached maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) or component unmounted. Stopping reconnects.`);
        setError('Could not connect to drone monitor. Please reload the page.');
        return;
      }

      // Clear any existing timeouts or intervals
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Close existing connection if any
      if (wsRef.current) {
        // Remove all event handlers to avoid memory leaks
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;

        // Close the connection
        try {
          wsRef.current.close();
        } catch (e) {
          console.error('Error closing WebSocket:', e);
        }
        wsRef.current = null;
      }

      try {
        console.log(`Connecting to WebSocket (attempt ${reconnectAttempts + 1})`);
        const ws = new WebSocket('ws://localhost:8000/api/drone-frames/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected to backend');
          setError(null);
          reconnectAttempts = 0; // Reset counter on successful connection
          reconnectDelay = INITIAL_RECONNECT_DELAY; // Reset delay

          // Set up heartbeat to keep connection alive
          heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000); // Send heartbeat every 30 seconds
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Only log important events to reduce console spam
            if (data.type !== 'pong') {
              console.log('Received WebSocket message:', data.type);
            }

            if (data.type === 'init') {
              // Initial data with existing frames
              console.log('Received initial frames:', data.frames.length);
              setDroneFrames(data.frames);
              setLoading(false);
            } else if (data.type === 'new_frame') {
              // New frame arrived - avoid logging every frame
              setDroneFrames((prevFrames) => {
                const newFrames = [...prevFrames, data.frame];
                // Keep only the last 10 frames
                return newFrames.slice(Math.max(0, newFrames.length - 10));
              });
              setLoading(false);
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          // Don't set error or reconnect here, let onclose handle it
        };

        ws.onclose = (event) => {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }

          // Don't attempt to reconnect if component is unmounted
          if (!isActive) return;

          console.log(`WebSocket closed (code: ${event.code})`);
          reconnectAttempts++;

          // Implement exponential backoff with jitter for reconnection
          const jitter = Math.random() * 0.3 * reconnectDelay;
          const actualDelay = reconnectDelay + jitter;
          reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);

          setError(`Connection to drone monitor lost. Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

          // Schedule reconnection
          reconnectTimeout = setTimeout(() => {
            if (isActive) connectWebSocket();
          }, actualDelay);
        };
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        reconnectAttempts++;
        setError(`Failed to connect to drone monitor. Will retry... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

        // Schedule reconnection with exponential backoff
        reconnectTimeout = setTimeout(() => {
          if (isActive) connectWebSocket();
        }, reconnectDelay);

        reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      }
    };

    // Start the initial connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up WebSocket connections');
      isActive = false; // Prevent reconnection attempts

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      if (wsRef.current) {
        // Remove all event handlers
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;

        // Close the connection
        try {
          wsRef.current.close();
        } catch (e) {
          console.error('Error closing WebSocket on unmount:', e);
        }
        wsRef.current = null;
      }
    };
  }, []);
  
  // Fetch drone frames manually via HTTP endpoint
  const fetchDroneFrames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching drone frames from API');
      const response = await axios.get('/api/drone-frames/latest');
      
      console.log('Received frames from API:', response.data.length);
      setDroneFrames(response.data);
    } catch (error) {
      console.error('Error fetching drone frames:', error);
      setError('Failed to load drone frames. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle open image in dialog
  const handleOpenImage = (frame, type) => {
    setSelectedFrame(frame);
    setDialogImageType(type);
    setOpenImageDialog(true);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Format location
  const formatLocation = (location) => {
    if (!location) return 'Unknown';
    const { lat, lng, altitude } = location;
    return `${lat?.toFixed(6) || 'N/A'}, ${lng?.toFixed(6) || 'N/A'}, Alt: ${altitude?.toFixed(1) || 'N/A'}m`;
  };

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Drone Monitor
      </Typography>
      
      <div className="drone-monitor">
        <div className="drone-monitor-header">
          <h2 className="monitor-title">
            Live Feed
            <span className="frame-count">{droneFrames.length} frames</span>
          </h2>
          <button 
            className="refresh-button"
            onClick={fetchDroneFrames}
            disabled={loading}
          >
            <span className="refresh-icon"></span>
            Refresh
          </button>
        </div>
      
      {error && (
        <div className="error-alert">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : droneFrames.length === 0 ? (
        <div className="empty-state">
          <div className="satellite-icon"></div>
          <h3>No Drone Data Available</h3>
          <p>Waiting for drone feeds to become available</p>
          <button 
            className="refresh-button"
            onClick={fetchDroneFrames}
          >
            <span className="refresh-icon"></span>
            Refresh
          </button>
        </div>
      ) : (
        <div className="drone-frames-list">
          {droneFrames.slice().reverse().map((frame) => (
            <div key={frame.id} className="drone-frame-card">
              <div className="drone-frame-content">
                <div className="drone-frame-header">
                  <div className="drone-frame-timestamp">
                    <span className="timestamp-icon"></span>
                    {formatTimestamp(frame.timestamp)}
                  </div>
                  
                  <div className="drone-frame-location">
                    <span className="location-icon"></span>
                    {formatLocation(frame.location)}
                  </div>
                  
                  <div className="drone-frame-chips">
                    <span className="drone-id-chip">
                      {frame.droneId}
                    </span>
                    
                    {frame.hasRegularFrame && (
                      <span className="regular-chip">
                        Regular
                      </span>
                    )}
                    
                    {frame.hasThermalFrame && (
                      <span className="thermal-chip">
                        Thermal
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="drone-frame-images">
                  {frame.hasRegularFrame && (
                    <div className="drone-frame-image-container">
                      <div className="drone-frame-image-header">
                        <h4>Regular Camera</h4>
                      </div>
                      <div className="image-wrapper">
                        <img
                          className="drone-frame-image"
                          src={`data:image/jpeg;base64,${frame.regularFrame}`}
                          alt="Drone regular camera feed"
                          onClick={() => handleOpenImage(frame, 'regular')}
                        />
                        <button 
                          className="expand-button"
                          onClick={() => handleOpenImage(frame, 'regular')}
                        >
                          <span className="expand-icon"></span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {frame.hasThermalFrame && (
                    <div className="drone-frame-image-container">
                      <div className="drone-frame-image-header">
                        <h4>Thermal Camera</h4>
                      </div>
                      <div className="image-wrapper">
                        <img
                          className="drone-frame-image"
                          src={`data:image/jpeg;base64,${frame.thermalFrame}`}
                          alt="Drone thermal camera feed"
                          onClick={() => handleOpenImage(frame, 'thermal')}
                        />
                        <button 
                          className="expand-button"
                          onClick={() => handleOpenImage(frame, 'thermal')}
                        >
                          <span className="expand-icon"></span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Image dialog */}
      {openImageDialog && selectedFrame && (
        <div className="image-dialog-overlay" onClick={() => setOpenImageDialog(false)}>
          <div className="image-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>
                {dialogImageType === 'regular' ? 'Regular Camera View' : 'Thermal Camera View'}
                <span className="dialog-timestamp">
                  {formatTimestamp(selectedFrame.timestamp)}
                </span>
              </h3>
              <button 
                className="dialog-close"
                onClick={() => setOpenImageDialog(false)}
              >
                &times;
              </button>
            </div>
            <div className="dialog-content">
              <img
                className="dialog-image"
                src={`data:image/jpeg;base64,${dialogImageType === 'regular' 
                  ? selectedFrame.regularFrame 
                  : selectedFrame.thermalFrame}`}
                alt={`Drone ${dialogImageType} camera feed`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default DroneMonitor;