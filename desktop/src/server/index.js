const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const cors = require('cors');
const path = require('path');

let io;

function getAllLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('virtual') || 
            name.toLowerCase().includes('vmware') || 
            name.toLowerCase().includes('vbox') || 
            name.toLowerCase().includes('zerotier') ||
            name.toLowerCase().includes('tailscale') ||
            name.toLowerCase().includes('tunnel')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
                    addresses.unshift(iface.address);
                } else {
                    addresses.push(iface.address);
                }
            }
        }
    }
    return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

function getLocalIP() {
    return getAllLocalIPs()[0];
}

function startServer(onStatusChange, deps = {}) {
    const { db, scraper } = deps;
    const app = express();
    app.use(cors());
    app.use(express.json());

    // API Endpoints for Mobile Sync
    if (db) {
        app.get('/api/songs', async (req, res) => {
            try {
                const songs = await db.searchSongs(''); // Returns all songs
                res.json({ success: true, songs });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        app.get('/api/schedule', async (req, res) => {
            try {
                const schedule = await db.getSchedule();
                res.json({ success: true, schedule, updatedAt: db.getScheduleUpdatedAt ? db.getScheduleUpdatedAt() : 0 });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        app.post('/api/schedule', async (req, res) => {
            try {
                const { schedule, updatedAt } = req.body;
                if (!Array.isArray(schedule)) throw new Error("Schedule must be an array");
                
                // Timestamp-based conflict resolution: latest modification wins
                const desktopUpdatedAt = db.getScheduleUpdatedAt ? db.getScheduleUpdatedAt() : 0;
                const mobileUpdatedAt = updatedAt || 0;
                
                if (mobileUpdatedAt > desktopUpdatedAt) {
                    // Mobile is newer — overwrite desktop schedule
                    await db.clearSchedule();
                    for (const item of schedule) {
                        await db.addToSchedule(item.songId);
                    }
                    const newSchedule = await db.getSchedule();
                    const newUpdatedAt = db.getScheduleUpdatedAt ? db.getScheduleUpdatedAt() : Date.now();
                    if (io) io.emit('schedule-updated', newSchedule);
                    res.json({ success: true, message: "Mobile schedule applied (newer)", winner: 'mobile', schedule: newSchedule, updatedAt: newUpdatedAt });
                } else {
                    // Desktop is newer (or equal) — reject mobile, return desktop schedule
                    const desktopSchedule = await db.getSchedule();
                    res.json({ success: true, message: "Desktop schedule kept (newer)", winner: 'desktop', schedule: desktopSchedule, updatedAt: desktopUpdatedAt });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        app.post('/api/add-song', async (req, res) => {
            try {
                const { songData } = req.body;
                await db.addSong(songData);
                res.json({ success: true, message: "Song added successfully" });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    if (scraper) {
        app.get('/api/scrape', async (req, res) => {
            try {
                const query = req.query.q;
                if (!query) return res.status(400).json({ success: false, error: "Missing query parameter" });
                
                const results = await scraper.searchLyrics(query);
                
                // For each result, pre-fetch the actual lyrics content to return directly if possible
                // Wait, fetching 15 pages takes too long. Just return results, and let mobile app fetch content individually.
                res.json({ success: true, results });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        app.post('/api/fetch-lyrics', async (req, res) => {
            try {
                const { url } = req.body;
                if (!url) return res.status(400).json({ success: false, error: "Missing url parameter" });
                
                const lyrics = await scraper.fetchLyricsContent(url);
                res.json({ success: true, lyrics });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    // Serve static files for the remote control UI
    const remotePath = path.join(__dirname, '../../public/remote');
    app.use(express.static(remotePath));

    // Serve static files for the stage display viewer
    const viewerPath = path.join(__dirname, '../../public/viewer');
    app.use('/viewer', express.static(viewerPath));
    
    // Fallback for capitalized /Viewer typo
    app.get('/Viewer', (req, res) => {
        res.redirect('/viewer/');
    });

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

module.exports = { startServer, getLocalIP, getAllLocalIPs };
