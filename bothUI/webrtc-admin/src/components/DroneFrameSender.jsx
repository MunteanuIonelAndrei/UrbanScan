import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './DroneFrameSender.css';

// Component for sending drone frames to the city monitoring system
const DroneFrameSender = ({
  regularVideoRef,
  thermalVideoRef,
  connectionStatus,
  thermalAvailable,
  sendCommand,
  droneLocation: externalDroneLocation, // Receive the current drone location from parent
  isInTopBar = false // Flag to indicate if this component is in the top bar
}) => {
  // State for sending configuration
  const [sendInterval, setSendInterval] = useState(30); // Default 30 seconds
  const [isActive, setIsActive] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  // Timer references
  const countdownTimerRef = useRef(null);

  // Function to get base64 from video frame
  const captureFrame = async (videoRef) => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const dataURL = canvas.toDataURL('image/jpeg', 0.8);
      return dataURL.split(',')[1]; // Remove the data:image/jpeg;base64, part
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  };

  // Function to send frames to backend
  const sendFramesToBackend = async () => {
    try {
      setError(null);

      if (connectionStatus !== 'connected') {
        throw new Error('Drone is not connected');
      }

      // No longer requesting location here, using the externally provided location

      // Capture frames
      const regularFrame = await captureFrame(regularVideoRef);
      if (!regularFrame) {
        throw new Error('Failed to capture regular camera frame');
      }

      // Capture thermal frame if available
      const thermalFrame = thermalAvailable ? await captureFrame(thermalVideoRef) : null;

      // Format location data to match expected API format with safe fallbacks
      const locationData = externalDroneLocation ? {
        lat: externalDroneLocation.lat || 0,
        lng: externalDroneLocation.lon || externalDroneLocation.lng || 0,
        altitude: externalDroneLocation.alt || externalDroneLocation.altitude || 0
      } : { lat: 0, lng: 0, altitude: 0 };

      console.log('Sending frames to backend with location:', locationData);

      // Prepare payload
      const payload = {
        regularFrame,
        thermalFrame,
        location: locationData,
        timestamp: new Date().toISOString(),
        droneId: 'drone-1'
      };

      // Fixed axios request - removed the incorrect path after the config object
      const response = await axios.post(
        'http://localhost:8000/api/drone-frames',
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200 || response.status === 201) {
        setLastSentTime(new Date());
        setSuccess('Frames sent successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error sending frames:', err);
      setError(err.message || 'Failed to send frames');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Clear all timers
  const clearTimers = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  // Handle toggle activation/deactivation
  const handleToggleChange = (newActive) => {
    // Always clear existing timers first
    clearTimers();
    
    if (newActive) {
      // Send frames immediately
      sendFramesToBackend();
      
      // Set initial countdown value
      setCountdown(sendInterval);
      
      // Create a dedicated function for the countdown timer
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // When countdown reaches 0, send frames and reset
            sendFramesToBackend();
            return sendInterval;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Just clear timers and reset countdown
      setCountdown(null);
    }
    
    setIsActive(newActive);
  };

  // Handle manual send button
  const handleManualSend = () => {
    // Send frames immediately
    sendFramesToBackend();
    
    // If automatic sending is active, reset the countdown
    if (isActive) {
      setCountdown(sendInterval);
    }
  };

  // Handle interval change
  const handleIntervalChange = (e) => {
    const newInterval = parseInt(e.target.value, 10);
    if (!isNaN(newInterval) && newInterval > 0) {
      setSendInterval(newInterval);
    }
  };

  // Effect to manage timers when sendInterval changes while active
  useEffect(() => {
    // Only need to update timers if already active
    if (isActive) {
      // Clear existing timers
      clearTimers();
      
      // Reset countdown to new interval
      setCountdown(sendInterval);
      
      // Create a single timer that handles both countdown and sending
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // When countdown reaches 0, send frames and reset
            sendFramesToBackend();
            return sendInterval;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    // Clean up when sendInterval or isActive changes
    return () => {
      if (isActive) {
        clearTimers();
      }
    };
  }, [sendInterval, isActive]);

  // Clean up timers on unmount
  useEffect(() => {
    // Effect cleanup function
    return () => {
      // Make sure to clear all timers when component unmounts
      clearTimers();
    };
  }, []);

  // Toggle panel visibility
  const togglePanel = () => {
    setShowPanel(!showPanel);
  };

  // Button only component for top bar
  if (isInTopBar && !showPanel) {
    return (
      <button
        className={`city-monitoring-button ${isActive ? 'sending-active' : ''}`}
        onClick={togglePanel}
      >
        {isActive ? 'CITY PROJ ⚫' : 'CITY PROJ'}
      </button>
    );
  }

  // Panel component
  if (showPanel) {
    return (
      <div className="drone-frame-sender">
        <div className="sender-header">
          <h3 className="sender-title">City Monitoring Integration</h3>

          <div className="panel-controls">
            <div className="sending-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => handleToggleChange(e.target.checked)}
                  disabled={connectionStatus !== 'connected'}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">{isActive ? 'Sending Active' : 'Sending Disabled'}</span>
            </div>

            <button className="close-panel-button" onClick={togglePanel}>×</button>
          </div>
        </div>

        <div className="controls-row">
          <div className="interval-input-container">
            <label htmlFor="interval-input">Interval (seconds)</label>
            <input
              id="interval-input"
              type="number"
              value={sendInterval}
              onChange={handleIntervalChange}
              disabled={isActive}
              min="1"
            />
          </div>

          <button
            className="send-button"
            onClick={handleManualSend}
            disabled={connectionStatus !== 'connected'}
          >
            Send Now
          </button>

          {isActive && countdown !== null && (
            <div className="next-send-timer">
              <div className="timer-icon"></div>
              <span className="countdown">Next send in {countdown} seconds</span>
            </div>
          )}
        </div>

        <div className="status-row">
          <div className="thermal-status">
            {thermalAvailable ? (
              <span className="thermal-available">Thermal camera available</span>
            ) : (
              <span className="thermal-unavailable">Thermal camera not available</span>
            )}
          </div>

          {lastSentTime && (
            <span className="last-sent">
              Last sent: {lastSentTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="drone-location">
          <span className="location-label">Drone Location:</span>
          <span className="location-value">
            {externalDroneLocation ? (
              `Lat: ${(externalDroneLocation.lat || 0.0).toFixed(6)}, Long: ${((externalDroneLocation.lon || externalDroneLocation.lng) || 0.0).toFixed(6)}, Alt: ${((externalDroneLocation.alt || externalDroneLocation.altitude) || 0.0).toFixed(1)}m`
            ) : (
              "No location data available"
            )}
          </span>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}
      </div>
    );
  }

  // Button only component for non-top bar
  return (
    <button
      className={`city-monitoring-button ${isActive ? 'sending-active' : ''}`}
      onClick={togglePanel}
    >
      {isActive ? 'Sending Frames to CityProj' : 'City Monitoring'}
    </button>
  );
};

export default DroneFrameSender;