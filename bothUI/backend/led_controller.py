#!/usr/bin/env python3
"""
led_controller.py
---------
Manages the LED strip control
Handles color setting for visual indicators
"""

import time
import threading

# Import Pi5Neo library for LED control
try:
    from pi5neo import Pi5Neo
    LED_AVAILABLE = True
except ImportError as e:
    LED_AVAILABLE = False
    print(f"[LED] Pi5Neo import error: {e}")
    print("[LED] LED control won't work - module not found")

class LedController:
    """Controls the LED strip on the drone"""
    
    def __init__(self):
        self.neo = None
        self.is_available = False
        self.animation_thread = None
        self.stop_animation = threading.Event()
        
        # Initialize the LED controller
        self._initialize_leds()
    
    def _initialize_leds(self):
        """Initialize the LED controller"""
        if not LED_AVAILABLE:
            print("[LED] Pi5Neo module not available. LED control disabled.")
            return False
        
        try:
            # Check if the SPI device exists
            import os
            if os.path.exists('/dev/spidev0.0'):
                print("[LED] SPI device exists at /dev/spidev0.0")
            else:
                print("[LED] WARNING: SPI device /dev/spidev0.0 does not exist!")
                # Try to list available devices
                os.system("ls -la /dev/spi* 2>&1 || echo 'No SPI devices found'")
            
            # Initialize the Pi5Neo class with 16 LEDs and an SPI speed of 800kHz
            print("[LED] Initializing Pi5Neo LED controller")
            self.neo = Pi5Neo('/dev/spidev0.0', 16, 800)
            print("[LED] Pi5Neo object created successfully")
            
            # Turn on all LEDs to white briefly as a test
            print("[LED] Testing LEDs with white color")
            self.neo.fill_strip(255, 255, 255)
            self.neo.update_strip()
            print("[LED] LED command sent - flashing white to test")
            time.sleep(0.5)
            
            # Then turn them off
            self.neo.fill_strip(0, 0, 0)
            self.neo.update_strip()
            print("[LED] LEDs turned off after test")
            
            self.is_available = True
            return True
            
        except Exception as e:
            print(f"[LED] Error initializing Pi5Neo: {e}")
            import traceback
            traceback.print_exc()
            print("[LED] LED control won't work - initialization failed")
            self.neo = None
            self.is_available = False
            return False
    
    def set_color(self, r, g, b):
        """Set the LED strip to a specific color"""
        if not self.is_available or not self.neo:
            return False
            
        try:
            # Make sure all values are integers
            r = int(r)
            g = int(g)
            b = int(b)
            
            # Ensure values are in valid range (0-255)
            r = max(0, min(255, r))
            g = max(0, min(255, g))
            b = max(0, min(255, b))
            
            # Stop any ongoing animations
            self.stop_animation.set()
            if self.animation_thread and self.animation_thread.is_alive():
                self.animation_thread.join(timeout=1.0)
            self.stop_animation.clear()
            
            # Set the color
            self.neo.fill_strip(r, g, b)
            self.neo.update_strip()
            
            return True
            
        except Exception as e:
            print(f"[LED] Error controlling LEDs: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _animation_thread_function(self, animation_type, duration, **kwargs):
        """Thread function for LED animations"""
        start_time = time.time()
        end_time = start_time + duration if duration > 0 else float('inf')
        
        try:
            if animation_type == "blink":
                color_r = kwargs.get('r', 255)
                color_g = kwargs.get('g', 255)
                color_b = kwargs.get('b', 255)
                interval = kwargs.get('interval', 0.5)
                
                while time.time() < end_time and not self.stop_animation.is_set():
                    # On
                    self.neo.fill_strip(color_r, color_g, color_b)
                    self.neo.update_strip()
                    time.sleep(interval)
                    
                    # Check if stop was requested during the sleep
                    if self.stop_animation.is_set():
                        break
                    
                    # Off
                    self.neo.fill_strip(0, 0, 0)
                    self.neo.update_strip()
                    time.sleep(interval)
                    
                    # Check if stop was requested during the sleep
                    if self.stop_animation.is_set():
                        break
                        
            elif animation_type == "pulse":
                color_r = kwargs.get('r', 255)
                color_g = kwargs.get('g', 255)
                color_b = kwargs.get('b', 255)
                cycle_time = kwargs.get('cycle_time', 2.0)
                
                while time.time() < end_time and not self.stop_animation.is_set():
                    # Calculate the brightness based on a sine wave
                    elapsed = (time.time() - start_time) % cycle_time
                    phase = elapsed / cycle_time
                    brightness = int(128 + 127 * math.sin(2 * math.pi * phase))
                    
                    # Scale the RGB values by the brightness
                    scaled_r = int(color_r * brightness / 255)
                    scaled_g = int(color_g * brightness / 255)
                    scaled_b = int(color_b * brightness / 255)
                    
                    self.neo.fill_strip(scaled_r, scaled_g, scaled_b)
                    self.neo.update_strip()
                    time.sleep(0.05)  # Small sleep to not overwhelm the SPI bus
                    
                    # Check if stop was requested during the sleep
                    if self.stop_animation.is_set():
                        break
                        
            elif animation_type == "rainbow":
                while time.time() < end_time and not self.stop_animation.is_set():
                    for i in range(256):
                        if self.stop_animation.is_set():
                            break
                            
                        # Create rainbow effect
                        r = int(128 + 127 * math.sin(i * 0.024))
                        g = int(128 + 127 * math.sin((i * 0.024) + 2.1))
                        b = int(128 + 127 * math.sin((i * 0.024) + 4.2))
                        
                        self.neo.fill_strip(r, g, b)
                        self.neo.update_strip()
                        time.sleep(0.05)
                        
        except Exception as e:
            print(f"[LED] Error in animation thread: {e}")
            
        finally:
            # Make sure LEDs are off when animation is done
            if not self.stop_animation.is_set():  # Only if not stopped externally
                self.neo.fill_strip(0, 0, 0)
                self.neo.update_strip()
    
    def start_animation(self, animation_type, duration=0, **kwargs):
        """
        Start an LED animation
        
        Args:
            animation_type (str): Type of animation ('blink', 'pulse', 'rainbow')
            duration (float): Duration in seconds (0 for infinite)
            **kwargs: Additional parameters for the animation
                - r, g, b: Color values for blink and pulse
                - interval: Blink interval
                - cycle_time: Pulse cycle time
        
        Returns:
            bool: Success of the operation
        """
        if not self.is_available or not self.neo:
            return False
            
        try:
            # Import math for animations
            import math
            
            # Stop any ongoing animations
            self.stop_animation.set()
            if self.animation_thread and self.animation_thread.is_alive():
                self.animation_thread.join(timeout=1.0)
            self.stop_animation.clear()
            
            # Start the new animation
            self.animation_thread = threading.Thread(
                target=self._animation_thread_function,
                args=(animation_type, duration),
                kwargs=kwargs,
                daemon=True
            )
            self.animation_thread.start()
            
            return True
            
        except Exception as e:
            print(f"[LED] Error starting animation: {e}")
            return False
    
    def stop_all_animations(self):
        """Stop all running animations and turn off LEDs"""
        if not self.is_available or not self.neo:
            return False
            
        try:
            # Signal the animation thread to stop
            self.stop_animation.set()
            
            # Wait for the thread to finish
            if self.animation_thread and self.animation_thread.is_alive():
                self.animation_thread.join(timeout=1.0)
            
            # Reset the flag
            self.stop_animation.clear()
            
            # Turn off all LEDs
            self.neo.fill_strip(0, 0, 0)
            self.neo.update_strip()
            
            return True
            
        except Exception as e:
            print(f"[LED] Error stopping animations: {e}")
            return False