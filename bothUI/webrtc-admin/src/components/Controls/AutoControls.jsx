import React from 'react';
import { AUTO_CONTROLS } from '../Common/constants';

const AutoControls = ({ sendCommand }) => {
  return (
    <div className="auto-controls">
      {AUTO_CONTROLS.map((ctrl) => (
        <button
          key={ctrl.id}
          className={`auto-button ${ctrl.id}`}
          onClick={() => sendCommand(ctrl.command)}
        >
          {ctrl.label}
        </button>
      ))}
    </div>
  );
};

export default AutoControls;