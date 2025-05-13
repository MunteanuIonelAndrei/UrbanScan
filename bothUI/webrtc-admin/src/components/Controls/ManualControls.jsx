import React from 'react';
import { MANUAL_CONTROLS } from '../Common/constants';

const ManualControls = ({ activeKeys, sendCommand }) => {
  return (
    <div className="manual-controls">
      <div className="control-stick left-stick">
        {MANUAL_CONTROLS.slice(0, 4).map((ctrl) => (
          <button
            key={ctrl.id}
            className={`control-button ${ctrl.id} ${activeKeys[ctrl.key] ? "active" : ""}`}
            onMouseDown={() => sendCommand(ctrl.command)}
            onMouseUp={() => sendCommand(`${ctrl.command}_STOP`)}
            onTouchStart={() => sendCommand(ctrl.command)}
            onTouchEnd={() => sendCommand(`${ctrl.command}_STOP`)}
          >
            {ctrl.label}
            <span className="key-hint">{ctrl.key.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="control-stick right-stick">
        {MANUAL_CONTROLS.slice(4).map((ctrl) => (
          <button
            key={ctrl.id}
            className={`control-button ${ctrl.id} ${activeKeys[ctrl.key] ? "active" : ""}`}
            onMouseDown={() => sendCommand(ctrl.command)}
            onMouseUp={() => sendCommand(`${ctrl.command}_STOP`)}
            onTouchStart={() => sendCommand(ctrl.command)}
            onTouchEnd={() => sendCommand(`${ctrl.command}_STOP`)}
          >
            {ctrl.label}
            <span className="key-hint">
              {ctrl.key === "ArrowUp"
                ? "↑"
                : ctrl.key === "ArrowRight"
                ? "→"
                : ctrl.key === "ArrowDown"
                ? "↓"
                : ctrl.key === "ArrowLeft"
                ? "←"
                : ctrl.key.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ManualControls;