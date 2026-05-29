const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, child } = require('firebase/database');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Aapka original Firebase Config (Bina Service account ke)
const firebaseConfig = {
  apiKey: "AIzaSyBvlth5mmdNI51eDnfBwLRUZiWTJF_ruqw",
  authDomain: "device-verification-3e162.firebaseapp.com",
  databaseURL: "https://device-verification-3e162-default-rtdb.firebaseio.com",
  projectId: "device-verification-3e162",
  storageBucket: "device-verification-3e162.firebasestorage.app",
  messagingSenderId: "934782597180",
  appId: "1:934782597180:web:7ea629e8ab3466df052b39"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const validateParams = (req, res, next) => {
    const botName = req.body.botName || req.params.botName;
    const userId = req.body.userId || req.params.userId;
    if (!botName || !userId) return res.status(400).json({ error: 'Missing Data' });
    next();
};

app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Backend is Live without Service Account!' });
});

app.post('/api/verify', validateParams, async (req, res) => {
    try {
        const { botName, userId, name, status, deviceData } = req.body;
        const timestamp = Date.now();
        
        let payload = { status, timestamp, verified: status === 'success' || status === 'already_verified' };
        
        if (status === 'success') {
            payload = { ...payload, name: name || 'Unknown', userid: userId, device: deviceData };
        }
        
        // Save to Firebase Realtime Database
        await set(ref(db, `/${botName}/${userId}`), payload);
        res.json({ success: true, payload });
    } catch (error) { 
        res.status(500).json({ error: 'Database save failed: ' + error.message }); 
    }
});

module.exports = app;
