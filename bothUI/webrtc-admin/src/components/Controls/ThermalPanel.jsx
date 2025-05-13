import React from 'react';
import { THERMAL_COLORMAPS } from '../Common/constants';

const ThermalPanel = ({ 
  showThermalPanel, 
  toggleThermalPanel, 
  thermalSettings, 
  updateThermalSettings,
  connectionStatus,
  videoActive,
  peerRef 
}) => {
  if (!showThermalPanel) return null;

  return (
    <div className="thermal-panel">
      <div className="thermal-panel-header">
        <h3>Thermal Camera Settings</h3>
        <button className="close-button" onClick={toggleThermalPanel}>
          ×
        </button>
      </div>
      <div className="thermal-settings">
        <div className="setting-group">
          <label>Colormap:</label>
          <select 
            value={thermalSettings.colormap}
            onChange={(e) => updateThermalSettings('colormap', parseInt(e.target.value))}
          >
            {THERMAL_COLORMAPS.map(colormap => (
              <option key={colormap.id} value={colormap.id}>
                {colormap.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="setting-group">
          <label>Contrast: {thermalSettings.contrast.toFixed(1)}</label>
          <input 
            type="range" 
            min="0.5" 
            max="3.0" 
            step="0.1"
            value={thermalSettings.contrast}
            onChange={(e) => updateThermalSettings('contrast', parseFloat(e.target.value))}
          />
        </div>
        
        <div className="setting-group">
          <label>Blur: {thermalSettings.blur}</label>
          <input 
            type="range" 
            min="0" 
            max="10" 
            value={thermalSettings.blur}
            onChange={(e) => updateThermalSettings('blur', parseInt(e.target.value))}
          />
        </div>
        
        <div className="setting-group">
          <label>Rotation: {thermalSettings.rotation}°</label>
          <div className="rotation-buttons">
            <button onClick={() => {
              const newRotation = (thermalSettings.rotation + 90) % 360;
              updateThermalSettings('rotation', newRotation);
            }}>
              Rotate 90°
            </button>
          </div>
        </div>
        
        <div className="setting-group">
          <label>Temperature Threshold: {thermalSettings.threshold}°C</label>
          <input 
            type="range" 
            min="-30" 
            max="60" 
            step="1"
            value={thermalSettings.threshold}
            onChange={(e) => updateThermalSettings('threshold', parseInt(e.target.value))}
          />
          <div className="range-markers">
            <span>-30°C</span>
            <span>0°C</span>
            <span>30°C</span>
            <span>60°C</span>
          </div>
        </div>
        
        <div className="setting-group">
          <label>Detection Mode:</label>
          <div className="detection-mode-buttons">
            <button 
              onClick={() => updateThermalSettings('detectionMode', 'over')}
              className={thermalSettings.detectionMode === 'over' ? 'active' : ''}
            >
              Above Threshold
            </button>
            <button 
              onClick={() => updateThermalSettings('detectionMode', 'under')}
              className={thermalSettings.detectionMode === 'under' ? 'active' : ''}
            >
              Below Threshold
            </button>
          </div>
        </div>
        
        <div className="setting-group">
          <label>Detection Regions:</label>
          <div className="toggle-button">
            <button 
              onClick={() => updateThermalSettings('detectRegions', !thermalSettings.detectRegions)}
              className={thermalSettings.detectRegions ? 'active' : ''}
            >
              {thermalSettings.detectRegions ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
        
        <div className="setting-group">
          <label>HUD Display:</label>
          <div className="toggle-button">
            <button 
              onClick={() => {
                if (peerRef.current && (connectionStatus === "connected" || videoActive)) {
                  const command = "THERMAL_TOGGLE_HUD";
                  console.log(`[Admin] Sending thermal command: ${command}`);
                  peerRef.current.send(command);
                }
              }}
            >
              Toggle HUD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThermalPanel;