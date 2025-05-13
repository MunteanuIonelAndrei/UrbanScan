import React, { useState } from 'react';

const MapPanel = ({
  showMap,
  toggleShowMap,
  droneLocation,
  targetLocation,
  elevationData,
  targetAltitude,
  setTargetAltitude,
  elevationLoading,
  connectionStatus,
  videoActive,
  peerRef,
  memoizedMap,

  // Surveillance props
  surveillanceMode,
  toggleSurveillanceMode,
  surveillancePoints,
  isAreaFinalized,
  finalizeArea,
  resetArea
}) => {
  // Surveillance settings state
  const [droneSpeed, setDroneSpeed] = useState(5);
  const [surveillanceAltitude, setSurveillanceAltitude] = useState(30);
  const [surveillanceStyle, setSurveillanceStyle] = useState("longest");
  const [lineSpacing, setLineSpacing] = useState(15);
  const [bufferZone, setBufferZone] = useState(5);
  if (!showMap) return null;

  const handleGoto = () => {
    if (!targetLocation) {
      alert("Please select a location on the map first");
      return;
    }
    if (peerRef.current && (connectionStatus === "connected" || videoActive)) {
      const gotoCommand = `GOTO:${targetLocation.lat}:${targetLocation.lng}:${targetAltitude}`;
      console.log(`[Admin] Sending goto command: ${gotoCommand}`);
      console.log(`[Admin] Target altitude is ${targetAltitude}m relative to takeoff`);
      if (elevationData) {
        const heightAboveGround = targetAltitude - elevationData.elevation;
        console.log(
          `[Admin] Height above target ground will be approximately ${heightAboveGround.toFixed(
            1
          )}m`
        );
      }
      peerRef.current.send(gotoCommand);
    } else {
      alert("Not connected to drone");
    }
  };

  const startSurveillanceMission = () => {
    if (peerRef.current && (connectionStatus === "connected" || videoActive)) {
      // Create a string with all surveillance points coordinates
      const pointsStr = surveillancePoints.map(p => `${p.lat}:${p.lng}`).join(',');

      // Add mission parameters
      const missionParams = `${droneSpeed}:${surveillanceAltitude}:${surveillanceStyle}:${lineSpacing}:${bufferZone}`;

      // Complete command with both area points and parameters
      const command = `START_SURVEILLANCE:${pointsStr}|${missionParams}`;

      peerRef.current.send(command);
      console.log(`[Admin] Starting surveillance mission with ${surveillancePoints.length} points and params: ${missionParams}`);
    } else {
      alert("Not connected to drone");
    }
  };

  return (
    <div className="map-panel">
      <div className="map-header">
        <h3>Navigation Map</h3>
        <button className="close-button" onClick={() => toggleShowMap()}>
          ×
        </button>
      </div>
      {memoizedMap}
      <div className="map-controls">
        {/* Surveillance Controls */}
        <div className="surveillance-controls">
          <button
            className={`surveillance-toggle ${surveillanceMode ? 'active' : ''}`}
            onClick={toggleSurveillanceMode}
          >
            {surveillanceMode ? "Exit Surveillance Mode" : "Enter Surveillance Mode"}
          </button>

          {surveillanceMode && (
            <div className="surveillance-actions">
              <span className="point-count">
                Points: {surveillancePoints.length}
                {surveillancePoints.length > 0 && !isAreaFinalized && (
                  <button className="add-another-pin" disabled={isAreaFinalized}>
                    Click on map to add another pin
                  </button>
                )}
              </span>

              {!isAreaFinalized && surveillancePoints.length >= 3 && (
                <button className="finalize-area" onClick={finalizeArea}>
                  Finalize Area
                </button>
              )}

              {(surveillancePoints.length > 0 || isAreaFinalized) && (
                <button className="reset-area" onClick={resetArea}>
                  Reset Area
                </button>
              )}

              {isAreaFinalized && (
                <div className="surveillance-settings">
                  <h4>Surveillance Settings</h4>

                  <div className="settings-grid">
                    <div className="settings-field">
                      <label htmlFor="drone-speed">Drone Speed (m/s):</label>
                      <input
                        id="drone-speed"
                        type="number"
                        min="1"
                        max="15"
                        value={droneSpeed}
                        onChange={(e) => setDroneSpeed(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))}
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="surveillance-altitude">Altitude (m):</label>
                      <input
                        id="surveillance-altitude"
                        type="number"
                        min="10"
                        max="120"
                        value={surveillanceAltitude}
                        onChange={(e) => setSurveillanceAltitude(Math.max(10, Math.min(120, parseInt(e.target.value) || 10)))}
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="line-spacing">Line Spacing (m):</label>
                      <input
                        id="line-spacing"
                        type="number"
                        min="5"
                        max="50"
                        value={lineSpacing}
                        onChange={(e) => setLineSpacing(Math.max(5, Math.min(50, parseInt(e.target.value) || 5)))}
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="buffer-zone">Buffer Zone (m):</label>
                      <input
                        id="buffer-zone"
                        type="number"
                        min="0"
                        max="20"
                        value={bufferZone}
                        onChange={(e) => setBufferZone(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                      />
                    </div>
                  </div>

                  <div className="settings-field style-field">
                    <label>Surveillance Style:</label>
                    <div className="surveillance-style-buttons">
                      <button
                        className={`style-button ${surveillanceStyle === 'longest' ? 'active' : ''}`}
                        onClick={() => setSurveillanceStyle('longest')}
                      >
                        Parallel to Longest Side
                      </button>
                      <button
                        className={`style-button ${surveillanceStyle === 'shortest' ? 'active' : ''}`}
                        onClick={() => setSurveillanceStyle('shortest')}
                      >
                        Parallel to Shortest Side
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Original controls */}
        {targetLocation && !surveillanceMode && (
          <div className="location-info">
            <div className="location-details">
              <span>Lat: {targetLocation.lat.toFixed(6)}</span>
              <span>Lon: {targetLocation.lng.toFixed(6)}</span>
              {elevationData && <span>Ground Elevation: {elevationData.elevation} m</span>}
            </div>
            {droneLocation && droneLocation.groundElevation !== undefined && elevationData && (
              <div className="location-details">
                <span className="elevation-comparison">
                  Ground Difference: {(elevationData.elevation - droneLocation.groundElevation).toFixed(1)} m{" "}
                  {elevationData.elevation > droneLocation.groundElevation ? " (higher)" : " (lower)"}
                </span>
              </div>
            )}
            <div className="altitude-control">
              <label htmlFor="altitude-input">Target Altitude (relative to takeoff):</label>
              <input
                id="altitude-input"
                type="number"
                min="1"
                max="500"
                value={targetAltitude}
                onChange={(e) => setTargetAltitude(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              />
              <div className="altitude-explanation">
                <p>This altitude is relative to takeoff height, not sea level</p>
              </div>
              {elevationData && (
                <span className="height-above-ground">
                  Height Above Target Ground: {(targetAltitude - elevationData.elevation).toFixed(1)} m
                </span>
              )}
              {droneLocation && targetAltitude !== null && (
                <span className="altitude-difference">
                  Altitude Change from Current: {(targetAltitude - droneLocation.alt).toFixed(1)} m
                  {targetAltitude > droneLocation.alt ? " (ascend)" : " (descend)"}
                </span>
              )}
            </div>
          </div>
        )}
        
        {!surveillanceMode && (
          <button
            className="goto-button"
            onClick={handleGoto}
            disabled={!targetLocation}
          >
            Go To Selected Location
          </button>
        )}

        {isAreaFinalized && surveillanceMode && (
          <button
            className="start-surveillance-button"
            onClick={startSurveillanceMission}
          >
            Start Surveillance Mission
          </button>
        )}
      </div>
    </div>
  );
};

export default MapPanel;