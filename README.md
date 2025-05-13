# UrbanScan: City Problem Management System with Drone Surveillance


🚀 Introducing UrbanScan – The Future of City Management is Here! 🌆📡

Say goodbye to overlooked city issues and slow responses! With drone surveillance and AI-powered insights, UrbanScan detects potholes, illegal dumping, damaged infrastructure, and more – all in real-time! 🛣️🕵️‍♂️⚠️

🎥 Watch the Demo Video Now to see how our smart system is making cities cleaner, safer, and more efficient! 🏙️🤖✨

👉 [YouTube Link](https://youtu.be/h-04P4i-g5Q) 

#SmartCity #UrbanScan #DroneTech #CitySurveillance #Innovation 🚁💡🌍

## Project Overview

A comprehensive city management system consisting of two main components:
1. **CityProject** - Web application for citizens to report city problems and for officials to manage reports
2. **BothUI** - Drone control and surveillance system that integrates with the main platform

UrbanScan provides an end-to-end solution for:
- Citizens to report city problems with photos and locations
- City officials to manage and resolve reported issues
- Drone-assisted surveillance for monitoring and validating reports
- AI-powered analysis of reports and drone imagery

## System Components

### CityProject

A web-based platform with:
- **Frontend**: React-based interfaces for citizens and administrators
- **Backend**: Python FastAPI application with PostgreSQL database
- **AI Integration**: OpenAI-powered analysis of reports for validity and classification

### BothUI

A drone control system with:
- **Backend**: Python-based drone control for Raspberry Pi + Pixhawk flight controller
- **Signaling Server**: WebRTC signaling for real-time communication
- **Admin Interface**: React-based web UI for drone operation and surveillance

## Installation and Setup

Each component requires its own specific setup. Please refer to the individual README files in each directory for detailed installation instructions:

- [CityProject README](/cityProject/README.md) - Main web application setup
- [BothUI Backend README](/bothUI/backend/README.md) - Drone controller setup
- [BothUI WebRTC Admin README](/bothUI/webrtc-admin/README.md) - Drone admin interface setup

### Quick Start

1. **Set up the CityProject web application**:
   ```bash
   cd cityProject/docker
   docker-compose up -d  # Start PostgreSQL
   
   cd ../backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   python -m app.initial_data  # Create initial admin user
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   
   # In another terminal
   cd ../frontend/client
   npm install
   npm start
   
   # In another terminal
   cd ../frontend/admin
   npm install
   npm start
   ```

2. **Set up the BothUI Drone Control System**:
   ```bash
   # Start the signaling server
   cd bothUI/signaling-server
   npm install
   node server.js
   
   # On the Raspberry Pi (with Pixhawk connected)
   cd bothUI/backend
   pip install -r requirements.txt
   python main.py
   
   # For the drone admin interface
   cd bothUI/webrtc-admin
   npm install
   npm start
   ```

## System Requirements

### CityProject
- Node.js 16+ and npm
- Python 3.9+
- Docker and Docker Compose
- PostgreSQL 12+
- OpenAI API key

### BothUI
- Raspberry Pi 4 (for drone controller)
- Pixhawk flight controller
- Python 3.9+
- Node.js 16+ and npm
- WebRTC capable browser

## Project Structure

```
/
├── cityProject/           # Main city problem reporting application
│   ├── backend/           # FastAPI backend application
│   ├── frontend/          # React frontends (client & admin)
│   └── docker/            # Docker configuration
│
└── bothUI/                # Drone control system
    ├── backend/           # Python-based drone controller for Raspberry Pi
    ├── signaling-server/  # WebRTC signaling server
    └── webrtc-admin/      # React-based drone admin interface
```

## Features

### CityProject
- Problem reporting with photo submission and geolocation
- Admin dashboard for issue management
- AI-based image analysis and report validity checking
- Report statistics and analytics
- Telegram integration for critical notifications

### BothUI
- Real-time drone control via WebRTC
- Live video streaming (regular and thermal cameras)
- Autonomous surveillance missions
- Map-based navigation
- LED light control for night operations

## License

MIT License
