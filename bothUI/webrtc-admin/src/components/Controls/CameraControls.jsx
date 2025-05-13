import React from 'react';

const CameraControls = ({ controlCameraTilt }) => {
  return (
    <div className="camera-tilt-controls">
      <button className="camera-tilt-button tilt-up" onClick={() => controlCameraTilt("up")}>
        Camera Up
      </button>
      <button className="camera-tilt-button tilt-down" onClick={() => controlCameraTilt("down")}>
        Camera Down
      </button>
    </div>
  );
};

export default CameraControls;