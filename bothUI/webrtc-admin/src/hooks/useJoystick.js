import { useState, useEffect, useRef } from 'react';
import { 
  JOYSTICK_POLL_INTERVAL, 
  JOYSTICK_DEADZONE, 
  THROTTLE_CHANGE_RATE,
  RC_CHANNELS,
  BUTTON_L1,
  BUTTON_R1
} from '../components/Common/constants';
import { applyDeadzone, mapToPWM } from '../components/Common/utils';

export const useJoystick = (controlMode, connectionStatus, videoActive, sendCommand) => {
  const [joystickConnected, setJoystickConnected] = useState(false);
  const [joystickName, setJoystickName] = useState("");
  const [currentPWMValues, setCurrentPWMValues] = useState({
    [RC_CHANNELS.ROLL]: 1500,
    [RC_CHANNELS.PITCH]: 1500,
    [RC_CHANNELS.THROTTLE]: 1000,
    [RC_CHANNELS.YAW]: 1500
  });
  
  const lastSentPWMValues = useRef({...currentPWMValues});
  const joystickPollingRef = useRef(null);
  const lastButtonState = useRef({});

  // Initialize joystick support
  useEffect(() => {
    const checkGamepads = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let anyConnected = false;
      
      for (const gamepad of gamepads) {
        if (gamepad) {
          anyConnected = true;
          if (!joystickConnected) {
            console.log(`[Admin] Joystick connected: ${gamepad.id}`);
            setJoystickConnected(true);
            setJoystickName(gamepad.id);
          }
          break;
        }
      }
      
      if (!anyConnected && joystickConnected) {
        console.log("[Admin] Joystick disconnected");
        setJoystickConnected(false);
        setJoystickName("");
      }
    };

    window.addEventListener("gamepadconnected", checkGamepads);
    window.addEventListener("gamepaddisconnected", checkGamepads);
    checkGamepads();

    return () => {
      window.removeEventListener("gamepadconnected", checkGamepads);
      window.removeEventListener("gamepaddisconnected", checkGamepads);
    };
  }, [joystickConnected]);

  // Process joystick inputs and send commands
  useEffect(() => {
    if (controlMode !== "manual" || !joystickConnected || 
        (connectionStatus !== "connected" && !videoActive)) {
      if (joystickPollingRef.current) {
        clearInterval(joystickPollingRef.current);
        joystickPollingRef.current = null;
      }
      return;
    }

    const pollJoystick = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gamepad = null;
      
      for (const pad of gamepads) {
        if (pad) {
          gamepad = pad;
          break;
        }
      }

      if (!gamepad) return;

      let rawYaw = gamepad.axes[0];
      let rawThrottle = -gamepad.axes[1];
      let rawRoll = gamepad.axes[2];
      let rawPitch = -gamepad.axes[3];
      
      const yaw = applyDeadzone(rawYaw, JOYSTICK_DEADZONE);
      const roll = applyDeadzone(rawRoll, JOYSTICK_DEADZONE);
      const pitch = applyDeadzone(rawPitch, JOYSTICK_DEADZONE);
      
      setCurrentPWMValues(prev => {
        const newValues = { ...prev };
        
        if (Math.abs(rawThrottle) > JOYSTICK_DEADZONE) {
          const throttleChange = rawThrottle * THROTTLE_CHANGE_RATE;
          newValues[RC_CHANNELS.THROTTLE] = Math.round(Math.max(1000, 
              Math.min(2000, prev[RC_CHANNELS.THROTTLE] + throttleChange)));
        }
        
        newValues[RC_CHANNELS.YAW] = mapToPWM(yaw);
        newValues[RC_CHANNELS.ROLL] = mapToPWM(roll);
        newValues[RC_CHANNELS.PITCH] = mapToPWM(pitch);
        
        return newValues;
      });
      
      const l1Pressed = gamepad.buttons[BUTTON_L1].pressed;
      const r1Pressed = gamepad.buttons[BUTTON_R1].pressed;
      
      if (l1Pressed && !lastButtonState.current.l1) {
        console.log("[Admin] L1 pressed - Camera Up");
        sendCommand("CAMERA_TILT_UP");
      }
      
      if (r1Pressed && !lastButtonState.current.r1) {
        console.log("[Admin] R1 pressed - Camera Down");
        sendCommand("CAMERA_TILT_DOWN");
      }
      
      lastButtonState.current.l1 = l1Pressed;
      lastButtonState.current.r1 = r1Pressed;
    };

    joystickPollingRef.current = setInterval(pollJoystick, JOYSTICK_POLL_INTERVAL);

    return () => {
      if (joystickPollingRef.current) {
        clearInterval(joystickPollingRef.current);
        joystickPollingRef.current = null;
      }
    };
  }, [controlMode, joystickConnected, connectionStatus, videoActive, sendCommand]);

  // Effect to send PWM values when they change
  useEffect(() => {
    if ((connectionStatus === "connected" || videoActive) && 
        controlMode === "manual" && joystickConnected) {
      
      Object.entries(currentPWMValues).forEach(([channel, pwmValue]) => {
        const channelNum = parseInt(channel);
        const intPwmValue = Math.round(pwmValue);
        
        if (Math.abs(intPwmValue - (lastSentPWMValues.current[channelNum] || 0)) >= 5) {
          const command = `MANUAL_PWM:${channelNum}:${intPwmValue}`;
          console.log(`[Admin] Sending PWM command: ${command}`);
          sendCommand(command);
          lastSentPWMValues.current[channelNum] = intPwmValue;
        }
      });
    }
  }, [currentPWMValues, connectionStatus, videoActive, controlMode, joystickConnected, sendCommand]);

  return {
    joystickConnected,
    joystickName,
    currentPWMValues
  };
};