import React from 'react';
import RegularVideo from './RegularVideo';
import ThermalVideo from './ThermalVideo';
import { VideoDisplayMode } from '../Common/constants';

const VideoDisplay = ({ 
  videoDisplayMode, 
  videoActive, 
  thermalAvailable,
  regularVideoRef,
  thermalVideoRef 
}) => {
  return (
    <div className={`video-container ${videoDisplayMode.toLowerCase()}`}>
      <RegularVideo 
        ref={regularVideoRef}
        videoActive={videoActive}
        hidden={videoDisplayMode === VideoDisplayMode.THERMAL}
      />
      <ThermalVideo 
        ref={thermalVideoRef}
        thermalAvailable={thermalAvailable}
        hidden={videoDisplayMode === VideoDisplayMode.REGULAR || !thermalAvailable}
      />
    </div>
  );
};

export default VideoDisplay;