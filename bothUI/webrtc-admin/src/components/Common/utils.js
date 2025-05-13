// Helper: convert HSV to RGB
export function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
      default:
        r = 0;
        g = 0;
        b = 0;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }
  
  // Helper function to limit cache size
  export function limitCacheSize(cache, maxSize) {
    const keys = Object.keys(cache);
    if (keys.length <= maxSize) return cache;
    
    // Remove oldest entries if over limit
    const newCache = { ...cache };
    const keysToRemove = keys.slice(0, keys.length - maxSize);
    keysToRemove.forEach(key => {
      delete newCache[key];
    });
    
    return newCache;
  }
  
  // Helper to apply deadzone to joystick values
  export function applyDeadzone(value, deadzone) {
    if (Math.abs(value) < deadzone) {
      return 0;
    }
    // Rescale the values outside deadzone to fill the full range
    return value > 0 
      ? (value - deadzone) / (1 - deadzone) 
      : (value + deadzone) / (1 - deadzone);
  }
  
  // Map joystick value to PWM range
  export function mapToPWM(value) {
    // Map from [-1, 1] to [1000, 2000]
    return Math.round(1500 + (value * 500));
  }