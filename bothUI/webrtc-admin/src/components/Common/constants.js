// Video display modes
export const VideoDisplayMode = {
  REGULAR: 'regular',
  THERMAL: 'thermal',
  SIDE_BY_SIDE: 'side-by-side',
  PICTURE_IN_PICTURE: 'pip'
};

// ExpressTURN STUN/TURN config
export const ICE_SERVERS = [
  // STUN server
  { urls: ["stun:stun.expressturn.com:3478"] },
  // TURN server - using your assigned relay server
  {
    urls: [
      // UDP options
      "turn:relay1.expressturn.com:3480?transport=udp",
      // TCP options for firewall traversal
      "turn:relay1.expressturn.com:3480?transport=tcp",
      "turn:relay1.expressturn.com:80?transport=tcp",
      // Secure options
      "turns:relay1.expressturn.com:443?transport=tcp",
      "turns:relay1.expressturn.com:5349?transport=tcp",
    ],
    username: "174686931792636027", // Replace with your ExpressTURN username
    credential: "+Kc1neP2q0un1Z2OTMxU6JDKcv0=" // Replace with your ExpressTURN password
  },
];

// Control commands for drone - mapped to radio joystick layout
export const MANUAL_CONTROLS = [
  { id: "throttle-up", label: "↑", command: "MANUAL_THROTTLE_UP", key: "w" },
  { id: "yaw-right", label: "→", command: "MANUAL_YAW_RIGHT", key: "d" },
  { id: "throttle-down", label: "↓", command: "MANUAL_THROTTLE_DOWN", key: "s" },
  { id: "yaw-left", label: "←", command: "MANUAL_YAW_LEFT", key: "a" },
  { id: "pitch-forward", label: "↑", command: "MANUAL_PITCH_FORWARD", key: "ArrowUp" },
  { id: "roll-right", label: "→", command: "MANUAL_ROLL_RIGHT", key: "ArrowRight" },
  { id: "pitch-backward", label: "↓", command: "MANUAL_PITCH_BACKWARD", key: "ArrowDown" },
  { id: "roll-left", label: "←", command: "MANUAL_ROLL_LEFT", key: "ArrowLeft" },
];

// RC Channels mapping
export const RC_CHANNELS = {
  ROLL: 1,     // Right stick - X axis
  PITCH: 2,    // Right stick - Y axis
  THROTTLE: 3, // Left stick - Y axis
  YAW: 4       // Left stick - X axis
};

// Auto mode controls
export const AUTO_CONTROLS = [
  { id: "arm", label: "ARM", command: "AUTO_ARM" },
  { id: "takeoff", label: "TAKEOFF", command: "AUTO_TAKEOFF" },
  { id: "land", label: "LAND", command: "AUTO_LAND" },
  { id: "rtl", label: "RETURN", command: "AUTO_RETURN_TO_LAUNCH" },
  { id: "forward", label: "FORWARD", command: "AUTO_FORWARD" },
  { id: "backward", label: "BACKWARD", command: "AUTO_BACKWARD" },
  { id: "left", label: "LEFT", command: "AUTO_LEFT" },
  { id: "right", label: "RIGHT", command: "AUTO_RIGHT" },
  { id: "up", label: "UP", command: "AUTO_UP" },
  { id: "down", label: "DOWN", command: "AUTO_DOWN" },
];

// LED preset colors
export const LED_PRESETS = [
  { id: "led-red", label: "RED", color: "#FF0000", r: 255, g: 0, b: 0 },
  { id: "led-green", label: "GREEN", color: "#00FF00", r: 0, g: 255, b: 0 },
  { id: "led-blue", label: "BLUE", color: "#0000FF", r: 0, g: 0, b: 255 },
  { id: "led-white", label: "WHITE", color: "#FFFFFF", r: 255, g: 255, b: 255 },
  { id: "led-off", label: "OFF", color: "#000000", r: 0, g: 0, b: 0 },
];

// Thermal camera colormap options
export const THERMAL_COLORMAPS = [
  { id: 0, name: "Jet" },
  { id: 1, name: "Hot" },
  { id: 2, name: "Magma" },
  { id: 3, name: "Inferno" },
  { id: 4, name: "Plasma" },
  { id: 5, name: "Bone" },
  { id: 6, name: "Spring" },
  { id: 7, name: "Autumn" },
  { id: 8, name: "Viridis" },
  { id: 9, name: "Parula" },
  { id: 10, name: "Rainbow" }
];

// Video recording commands
export const VIDEO_START_COMMAND = "VIDEO_START";
export const VIDEO_STOP_COMMAND = "VIDEO_STOP";

// MAXIMUM CACHE SIZE TO PREVENT MEMORY LEAKS
export const MAX_ELEVATION_CACHE_SIZE = 100;

// Joystick configs
export const JOYSTICK_POLL_INTERVAL = 50; // ms
export const JOYSTICK_DEADZONE = 0.05;
export const THROTTLE_CHANGE_RATE = 5; // PWM value change per interval at full stick deflection

// Gamepad button indices
export const BUTTON_L1 = 4;  // Left shoulder button
export const BUTTON_R1 = 5;  // Right shoulder button

// Image capture command
export const CAPTURE_COMMAND = "CAPTURE_IMAGES";