/******************************************************
 * signaling-server.js
 ******************************************************/
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os"); // Add os module to get network interfaces

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing
  },
});

// Function to get the server's IP address
function getServerIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  // Look for a non-internal IPv4 address
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  
  // Fall back to localhost if no external IP is found
  return '127.0.0.1';
}

const PORT = 4000;
const HOST = '0.0.0.0'; // Bind to all network interfaces

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on("offer", (offerPayload) => {
    console.log(`[Server] Received offer from ${socket.id}, broadcasting...`);
    socket.broadcast.emit("offer", offerPayload);
  });
  
  socket.on("answer", (answerPayload) => {
    console.log(`[Server] Received answer from ${socket.id}, broadcasting...`);
    socket.broadcast.emit("answer", answerPayload);
  });
  
  socket.on("ice-candidate", (candidatePayload) => {
    console.log(`[Server] Received ICE candidate from ${socket.id}, broadcasting...`);
    socket.broadcast.emit("ice-candidate", candidatePayload);
  });
  
  // Admin signals it's ready after a refresh
  socket.on("admin-ready", () => {
    console.log(`[Server] "admin-ready" from ${socket.id}, broadcasting...`);
    socket.broadcast.emit("admin-ready");
  });
  
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, HOST, () => {
  const serverIp = getServerIpAddress();
  console.log(`Signaling server running on http://${serverIp}:${PORT}`);
});
