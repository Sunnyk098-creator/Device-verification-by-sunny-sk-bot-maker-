const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Vercel serverless environment ke liye zaroori hai ki Firebase baar-baar initialize na ho
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

// Security Middleware
const validateParams = (req, res, next) => {
    const botName = req.body.botName || req.params.botName;
    const userId = req.body.userId || req.params.userId;
    if (!botName || !userId) return res.status(400).json({ error: 'Missing Data' });
    if (!/^[a-zA-Z0-9_-]+$/.test(botName) || !/^[a-zA-Z0-9_-]+$/.test(userId)) return res.status(400).json({ error: 'Invalid Format' });
    next();
};

// Route: Check verified status
app.get('/api/check/:botName/:userId', validateParams, async (req, res) => {
    try {
        const { botName, userId } = req.params;
        const snapshot = await db.ref(`/${botName}/${userId}`).once('value');
        if (snapshot.exists()) return res.json({ exists: true, data: snapshot.val() });
        res.json({ exists: false });
    } catch (error) { 
        res.status(500).json({ error: 'Server error' }); 
    }
});

// Route: Save verification
app.post('/api/verify', validateParams, async (req, res) => {
    try {
        const { botName, userId, name, status, deviceData } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const timestamp = Date.now();
        const ref = db.ref(`/${botName}/${userId}`);
        
        let payload = { status, timestamp, verified: status === 'success' || status === 'already_verified' };
        
        if (status === 'success') {
            payload = { ...payload, name: name || 'Unknown', userid: userId, ip, device: deviceData };
        }
        
        await ref.set(payload);
        res.json({ success: true, payload });
    } catch (error) { 
        res.status(500).json({ error: 'Failed to save' }); 
    }
});

// Vercel ke liye server ko export karna padta hai
module.exports = app;
