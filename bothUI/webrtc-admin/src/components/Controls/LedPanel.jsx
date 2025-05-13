import React from 'react';
import { LED_PRESETS } from '../Common/constants';

const LedPanel = ({ 
  showLedPanel, 
  toggleLedPanel, 
  ledColor, 
  setLedColor, 
  setLedColorAndSend,
  colorWheelRef,
  handleColorWheelInteraction
}) => {
  if (!showLedPanel) return null;

  return (
    <div className="led-panel">
      <div className="led-panel-header">
        <h3>LED Controls</h3>
        <button className="close-button" onClick={toggleLedPanel}>
          ×
        </button>
      </div>
      <div className="color-wheel-container">
        <div
          ref={colorWheelRef}
          className="color-wheel"
          onMouseDown={(e) => {
            const selectedColor = handleColorWheelInteraction(e, false);
            setLedColor(selectedColor);
          }}
          onMouseMove={(e) => e.buttons === 1 && handleColorWheelInteraction(e, false)}
          onTouchStart={(e) => {
            const selectedColor = handleColorWheelInteraction(e, false);
            setLedColor(selectedColor);
          }}
          onTouchMove={(e) => handleColorWheelInteraction(e, false)}
        >
          <div
            className="color-indicator"
            style={{
              backgroundColor: `rgb(${ledColor.r}, ${ledColor.g}, ${ledColor.b})`,
            }}
          />
        </div>
      </div>
      <div className="current-color">
        <div
          className="color-preview"
          style={{ backgroundColor: `rgb(${ledColor.r}, ${ledColor.g}, ${ledColor.b})` }}
        />
        <div className="rgb-display">
          R: {ledColor.r}, G: {ledColor.g}, B: {ledColor.b}
        </div>
      </div>
      <div className="rgb-input-container">
        <div className="rgb-input-field">
          <label htmlFor="r-input">R:</label>
          <input
            id="r-input"
            type="number"
            min="0"
            max="255"
            value={ledColor.r}
            onChange={(e) =>
              setLedColor({ ...ledColor, r: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })
            }
          />
        </div>
        <div className="rgb-input-field">
          <label htmlFor="g-input">G:</label>
          <input
            id="g-input"
            type="number"
            min="0"
            max="255"
            value={ledColor.g}
            onChange={(e) =>
              setLedColor({ ...ledColor, g: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })
            }
          />
        </div>
        <div className="rgb-input-field">
          <label htmlFor="b-input">B:</label>
          <input
            id="b-input"
            type="number"
            min="0"
            max="255"
            value={ledColor.b}
            onChange={(e) =>
              setLedColor({ ...ledColor, b: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })
            }
          />
        </div>
      </div>
      <div className="led-color-buttons">
        {LED_PRESETS.map((color) => (
          <button
            key={color.id}
            className="led-color-button"
            style={{ backgroundColor: color.color }}
            onClick={() => setLedColorAndSend(color.r, color.g, color.b)}
          >
            {color.label}
          </button>
        ))}
      </div>
      <button className="led-apply-button" onClick={() => setLedColorAndSend(ledColor.r, ledColor.g, ledColor.b)}>
        Apply Color
      </button>
    </div>
  );
};

export default LedPanel;