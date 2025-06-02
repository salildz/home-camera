import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import proxy from 'express-http-proxy';
import http from 'http';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ESP32_URL = process.env.ESP32_URL || 'http://192.168.1.41';
const LOGIN_USER = process.env.LOGIN_USER || 'admin';
const LOGIN_PASS = process.env.LOGIN_PASS || 'supersecret';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-this';

app.use(cors());
app.use(express.json());

let activeStream = null; // Aktif stream bağlantısı

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
};

const validateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Authorization header missing' });
    const token = authHeader.split(' ')[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ success: false, message: 'Invalid token' });
    next();
};

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === LOGIN_USER && password === LOGIN_PASS) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// STREAM endpoint: sadece bir client'a izin ver
app.get('/stream', (req, res, next) => {
    // Token kontrolü (header veya url parametresi)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Eğer zaten bir aktif stream varsa, onu kapat!
    if (activeStream) {
        try {
            activeStream.end();
        } catch (e) { }
        activeStream = null;
    }

    next();
}, (req, res) => {
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'close');

    // Aktif stream'i işaretle
    activeStream = res;

    const request = http.get(`${ESP32_URL}/stream`, (streamRes) => {
        streamRes.pipe(res);

        streamRes.on('close', () => {
            activeStream = null;
            console.log('Stream kapatıldı');
        });
        streamRes.on('error', (err) => {
            activeStream = null;
            console.error('Stream hatası:', err);
        });
        res.on('close', () => {
            activeStream = null;
            request.destroy();
        });
    });

    request.on('error', (err) => {
        activeStream = null;
        if (!res.headersSent) {
            res.status(502).json({ success: false, message: 'Cannot connect to camera' });
        } else {
            res.end();
        }
    });
});

app.get('/status', validateToken, proxy(ESP32_URL, { proxyReqPathResolver: () => '/status' }));
app.get('/move', validateToken, proxy(ESP32_URL, { proxyReqPathResolver: (req) => `/move${req.url.replace(/^\/move/, '')}` }));
app.get('/led', validateToken, proxy(ESP32_URL, { proxyReqPathResolver: (req) => `/led${req.url.replace(/^\/led/, '')}` }));
app.get('/reset', validateToken, proxy(ESP32_URL, { proxyReqPathResolver: (req) => `/reset${req.url.replace(/^\/reset/, '')}` }));

app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
});

app.listen(PORT, () => {
    console.log(`Backend API çalışıyor - Port: ${PORT}`);
    console.log(`ESP32 proxy hedefi: ${ESP32_URL}`);
});