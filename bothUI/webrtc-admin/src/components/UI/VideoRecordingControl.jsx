import React from 'react';

const VideoRecordingControl = ({
  videoActive,
  videoRecording,
  videoRecordingStatus,
  toggleRecordingPanel
}) => {
  // Don't render if recording is active (the stop button will be in StatusBar)
  if (videoRecording) {
    return null;
  }

  return (
    <div className="video-recording-control">
      <button
        className="record-button"
        onClick={toggleRecordingPanel}
        disabled={!videoActive}
      >
        RECORDING
      </button>
    </div>
  );
};

export default VideoRecordingControl;