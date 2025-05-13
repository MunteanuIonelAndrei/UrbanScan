# UrbanScan WebRTC Signaling Server

This is the signaling server for the UrbanScan drone control system. It facilitates WebRTC connections between the drone controller and the admin interface.

## Overview

The signaling server provides a simple socket.io-based relay for WebRTC signaling information, including:
- Session establishment
- Offer/answer exchange
- ICE candidate sharing
- Connection status updates

It acts as an intermediary only during the connection setup phase. Once a WebRTC peer connection is established, all video, audio, and data traffic flows directly between the drone and admin interface.

## Requirements

- Node.js 16+
- npm

## Installation

1. **Install dependencies**:
   ```bash
   cd bothUI/signaling-server
   npm install
   ```

2. **Start the server**:
   ```bash
   node server.js
   ```

The server will automatically detect and display its IP address, listening on port 4000 by default.

## Configuration

You can modify the following settings in `server.js`:
- `PORT`: The server port (default: 4000)
- `HOST`: The binding address (default: '0.0.0.0' to listen on all interfaces)
- CORS settings if needed for security in production

## Usage

The signaling server should be running before starting either the drone controller or the admin interface. Both components will automatically connect to this server to establish their WebRTC connection.

The server logs connection events and signaling messages for debugging purposes.

### API

The server handles the following socket.io events:

#### Incoming Events (from clients)
- `offer`: WebRTC offer from a peer
- `answer`: WebRTC answer from a peer
- `ice-candidate`: ICE candidates for connection establishment
- `admin-ready`: Signal that admin interface is ready to connect

#### Outgoing Events (to clients)
- `offer`: Broadcast offer to other peers
- `answer`: Broadcast answer to other peers
- `ice-candidate`: Broadcast ICE candidates to other peers
- `admin-ready`: Notify drone that admin is ready

## Deployment

For production deployment:

1. **Configure for security**:
   - Set up HTTPS using a valid certificate
   - Restrict CORS to specific origins
   - Add authentication if needed

2. **Use process manager**:
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name "urbanscan-signaling"
   pm2 save
   ```

3. **Set up as a system service**:
   ```bash
   pm2 startup
   ```

## Network Requirements

- The server must be accessible by both the drone controller and admin interface
- Port 4000 (or your configured port) must be open
- For use across different networks, ensure the server has a public IP or domain

## Troubleshooting

### Connection Issues
- Verify that the server is running and accessible from both clients
- Check firewall settings to ensure the port is open
- Use `netstat -tuln | grep 4000` to confirm the server is listening

### Performance
- The signaling server only handles connection establishment, not the actual WebRTC traffic
- Even with many clients, the server load should remain low
- Monitor for network bottlenecks if connecting many drones simultaneously

## License

MIT License