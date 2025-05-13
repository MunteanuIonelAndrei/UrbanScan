import React from 'react';

const StatusBar = ({
  connectionStatus,
  heartbeatError,
  joystickConnected,
  joystickName,
  captureStatus,
  videoRecording,
  videoRecordingStatus,
  droneLocation,
  lastValidAGL,
  children,
  handleVideoRecording
}) => {
  return (
    <div className="status-bar">
      <div className="left-controls">
        {children}
      </div>
      <div className="connection-status">
        Status: {connectionStatus.toUpperCase()}
        {heartbeatError && <span className="heartbeat-error">CONNECTION LOST</span>}
        {joystickConnected && (
          <span className="joystick-active" style={{ marginLeft: "1rem", color: "#2ecc71" }}>
            JOYSTICK ACTIVE {joystickName ? `(${joystickName.split('(')[0]})` : ''}
          </span>
        )}
        {captureStatus.lastCapture && (
          <span className="capture-success" style={{ marginLeft: "1rem", color: "#e74c3c" }}>
            IMAGES CAPTURED
          </span>
        )}
        {captureStatus.error && (
          <span className="capture-error" style={{ marginLeft: "1rem", color: "#e74c3c" }}>
            CAPTURE ERROR: {captureStatus.error}
          </span>
        )}
        {videoRecording && (
          <>
            <span className="recording-active" style={{ marginLeft: "1rem", color: "#e67e22" }}>
              RECORDING ⚫
            </span>
            <button
              className="record-button recording"
              onClick={handleVideoRecording}
              style={{ marginLeft: "0.5rem" }}
            >
              STOP RECORDING
            </button>
          </>
        )}
        {videoRecordingStatus.error && (
          <span className="recording-error" style={{ marginLeft: "1rem", color: "#e74c3c" }}>
            RECORDING ERROR: {videoRecordingStatus.error}
          </span>
        )}
        {droneLocation && (
          <span className="location-display">
            Lat: {droneLocation.lat.toFixed(6)}, Lon: {droneLocation.lon.toFixed(6)}, Alt:{" "}
            {droneLocation.alt.toFixed(1)}m
            {(droneLocation.heightAboveGround !== undefined || lastValidAGL !== null) &&
              ` (${(droneLocation.heightAboveGround !== undefined
                ? droneLocation.heightAboveGround
                : lastValidAGL
              ).toFixed(1)}m AGL)`}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusBar;