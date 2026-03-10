const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const cors = require('cors');
const path = require('path');

let io;

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function startServer(onStatusChange) {
    const app = express();
    app.use(cors());

    // Serve static files for the remote control UI
    const remotePath = path.join(__dirname, '../../public/remote');
    app.use(express.static(remotePath));

    // Explicit fallback for root
    app.get('/', (req, res) => {
        console.log(`[Server] Serving index.html to ${req.ip}`);
        res.sendFile(path.join(remotePath, 'index.html'));
    });

    // Logging middleware for debugging "Cannot GET"
    app.use((req, res, next) => {
        console.log(`[Server] ${req.method} ${req.url} - ${res.statusCode}`);
        next();
    });
    const server = http.createServer(app);
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        const count = io.engine.clientsCount;
        if (onStatusChange) onStatusChange({ status: 'Running', ip: getLocalIP(), connections: count });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
            const count = io.engine.clientsCount;
            if (onStatusChange) onStatusChange({ status: 'Running', ip: getLocalIP(), connections: count });
        });

        socket.on('command', (data) => {
            console.log('Received command:', data);
        });
    });

    const PORT = 3001;
    server.listen(PORT, '0.0.0.0', () => {
        const ip = getLocalIP();
        console.log(`Server running at http://${ip}:${PORT}`);
        if (onStatusChange) onStatusChange({ status: 'Running', ip: ip, connections: 0 });
    });

    return io;
}

module.exports = { startServer, getLocalIP };
