import React from 'react';

const RecordingPanel = ({
  showRecordingPanel,
  toggleRecordingPanel,
  videoRecordingFps,
  setVideoRecordingFps,
  handleVideoRecording,
  videoActive
}) => {
  const fpsOptions = [0.5, 1, 2, 5, 10, 15, 20, 30];
  
  const startRecording = () => {
    handleVideoRecording();
    toggleRecordingPanel();
  };
  
  if (!showRecordingPanel) return null;
  
  return (
    <div className="recording-panel">
      <div className="recording-panel-header">
        <h3>Recording Settings</h3>
        <button className="close-button" onClick={toggleRecordingPanel}>×</button>
      </div>
      
      <div className="recording-settings">
        <div className="fps-selection">
          <div className="fps-selection-header">Select Frame Rate (FPS):</div>
          <div className="fps-options-grid">
            {fpsOptions.map(fps => (
              <button 
                key={fps} 
                className={`fps-option ${fps === videoRecordingFps ? 'selected' : ''}`}
                onClick={() => setVideoRecordingFps(fps)}
              >
                {fps} FPS
              </button>
            ))}
          </div>
        </div>
        
        <div className="recording-info">
          <p>The selected frame rate affects thermal data recording performance.</p>
          <p>Lower values (0.5-2 FPS) are recommended for longer recordings.</p>
          <p>Higher values (10-30 FPS) provide smoother playback but use more storage.</p>
        </div>
        
        <button 
          className="start-recording-button"
          onClick={startRecording}
          disabled={!videoActive}
        >
          START RECORDING @ {videoRecordingFps} FPS
        </button>
      </div>
    </div>
  );
};

export default RecordingPanel;