const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Firebase Crash-Proof Initialization
let isFirebaseReady = false;

try {
    if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
        // Naya fix: Private key mein aane wale extra quotes aur spaces ko clean karega
        const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n').replace(/"/g, '');
        
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey
            }),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        isFirebaseReady = true;
    } else if (admin.apps.length) {
        isFirebaseReady = true;
    }
} catch (error) {
    console.error("Firebase Init Failed:", error);
}

// Security Middleware
const validateParams = (req, res, next) => {
    const botName = req.body.botName || req.params.botName;
    const userId = req.body.userId || req.params.userId;
    if (!botName || !userId) return res.status(400).json({ error: 'Missing Data' });
    next();
};

// Test Route - check karne ke liye ki backend zinda hai ya nahi
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Backend is Live!', firebaseConnected: isFirebaseReady });
});

// Main Route
app.post('/api/verify', validateParams, async (req, res) => {
    if (!isFirebaseReady) {
        return res.status(500).json({ error: 'Firebase Keys missing or incorrect in Vercel Settings' });
    }

    try {
        const db = admin.database();
        const { botName, userId, name, status, deviceData } = req.body;
        const timestamp = Date.now();
        const ref = db.ref(`/${botName}/${userId}`);
        
        let payload = { status, timestamp, verified: status === 'success' || status === 'already_verified' };
        
        if (status === 'success') {
            payload = { ...payload, name: name || 'Unknown', userid: userId, device: deviceData };
        }
        
        await ref.set(payload);
        res.json({ success: true, payload });
    } catch (error) { 
        res.status(500).json({ error: 'Database save failed: ' + error.message }); 
    }
});

module.exports = app;
