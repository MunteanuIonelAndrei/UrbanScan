#!/usr/bin/env python3
"""
main.py
---------
Entry point for the drone control system
Initializes all components and starts the main event loop
"""

import asyncio
import time
import signal
import sys
import threading

# Import our modules
from communication import CommunicationManager
from drone_control import DroneController
from camera_manager import CameraManager
from led_controller import LedController

# Global shutdown flag
shutdown_requested = False
location_thread_active = False

def signal_handler(sig, frame):
    """Handle CTRL+C and other termination signals"""
    global shutdown_requested, location_thread_active
    print("[Main] Shutdown signal received, cleaning up...")
    shutdown_requested = True
    location_thread_active = False

def location_reporting_loop(drone_controller):
    """Thread function that reports the drone location every 5 seconds"""
    global location_thread_active
    location_thread_active = True
    
    print("[Main] Location reporting thread started")
    
    while location_thread_active:
        location = drone_controller.get_location()
        if location:
            print(f"[Drone] Current location: Lat {location['lat']:.6f}, Lon {location['lon']:.6f}, Alt {location['rel_alt']:.2f}m, Heading {location['heading']}°")
        else:
            print("[Drone] Location not available")
        
        # Sleep for 5 seconds
        time.sleep(5)
    
    print("[Main] Location reporting thread stopped")

async def main():
    location_thread = None
    
    try:
        # Set up signal handling for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        print("[Main] Initializing drone control system...")
        
        # Initialize the LED controller
        led_controller = LedController()
        # Blink LEDs briefly to indicate startup
        if led_controller.is_available:
            led_controller.set_color(255, 255, 255)  # White
            await asyncio.sleep(0.5)
            led_controller.set_color(0, 0, 0)  # Off
        
        # Initialize the camera manager
        camera_manager = CameraManager()
        
        # Initialize the drone controller
        drone_controller = DroneController(led_controller)
        
        # Start location reporting thread
        location_thread = threading.Thread(target=location_reporting_loop, args=(drone_controller,))
        location_thread.daemon = True  # Thread will exit when main program exits
        location_thread.start()
        
        # Initialize the communication manager with references to other components
        comm_manager = CommunicationManager(
            camera_manager=camera_manager,
            drone_controller=drone_controller,
            led_controller=led_controller
        )
        
        # Connect to the signaling server
        await comm_manager.connect_to_server("http://172.20.10.3:4000")
        
        # Main loop to keep the program running
        while not shutdown_requested:
            await asyncio.sleep(1)
            
    except Exception as e:
        print(f"[Main] Error in main loop: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        print("[Main] Cleaning up resources...")
        
        # Stop the location reporting thread
        global location_thread_active
        location_thread_active = False
        
        if location_thread and location_thread.is_alive():
            location_thread.join(timeout=2.0)  # Wait for the thread to terminate
        
        # Clean up all components
        try:
            await comm_manager.disconnect()
        except Exception as e:
            print(f"[Main] Error during communication cleanup: {e}")
        
        try:
            drone_controller.cleanup()
        except Exception as e:
            print(f"[Main] Error during drone controller cleanup: {e}")
        
        try:
            camera_manager.cleanup()
        except Exception as e:
            print(f"[Main] Error during camera cleanup: {e}")
        
        try:
            led_controller.set_color(0, 0, 0)  # Turn off LEDs
        except Exception as e:
            print(f"[Main] Error turning off LEDs: {e}")
        
        print("[Main] Shutdown complete")

if __name__ == "__main__":
    asyncio.run(main())