const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, child } = require('firebase/database');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const firebaseConfig = {
    apiKey: "AIzaSyBvlth5mmdNI51eDnfBwLRUZiWTJF_ruqw",
    authDomain: "device-verification-3e162.firebaseapp.com",
    databaseURL: "https://device-verification-3e162-default-rtdb.firebaseio.com",
    projectId: "device-verification-3e162",
    storageBucket: "device-verification-3e162.firebasestorage.app",
    messagingSenderId: "934782597180",
    appId: "1:934782597180:web:7ea629e8ab3466df052b39"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

app.post('/api/verify', async (req, res) => {
    // Hardware ID ab naya hathiyar hai
    const { botName, userId, userName, ip, deviceData, secretId, hardwareId } = req.body;

    if (!botName || !userId) {
        return res.status(400).json({ error: 'Missing Data' });
    }

    // --- VPN & PROXY DETECTION ---
    if (ip && ip !== "Unknown") {
        try {
            const vpnRes = await fetch(`http://ip-api.com/json/${ip}?fields=proxy,hosting`);
            const vpnData = await vpnRes.json();
            if (vpnData.proxy || vpnData.hosting) {
                return res.json({ status: 'vpn_detected' });
            }
        } catch (e) {
            console.error("VPN Check Error", e);
        }
    }

    // --- STRICT DATABASE SECURITY CHECK ---
    try {
        const dbRef = ref(db);
        const botRef = child(dbRef, botName);
        const snapshot = await get(botRef);

        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            
            // 1. Agar user khud pehle verify ho chuka hai (Success)
            if (allUsers[userId] && allUsers[userId].status === 'success') {
                return res.json({ status: 'already_verified' });
            }

            // 2. Loop through all verified users to catch Clones & Frauds
            for (const [existingUserId, userData] of Object.entries(allUsers)) {
                
                if (existingUserId !== userId && userData.status === 'success') {
                    
                    // 👉 THE CLONE BLOCKER: Hardware ID check
                    // Agar Hardware ID (GPU Fingerprint), ya Storage ID, ya exact IP (without Wi-Fi excuse) same hai
                    if (userData.hardwareId === hardwareId || userData.secretId === secretId || userData.ip === ip) {
                        
                        // Fake Verification pakdi gayi
                        let blockReason = 'duplicate_ip_detected';
                        if (userData.hardwareId === hardwareId) blockReason = 'cloned_app_hardware_detected';
                        else if (userData.secretId === secretId) blockReason = 'duplicate_browser_storage';

                        await set(ref(db, `/${botName}/${userId}`), {
                            name: userName,
                            userid: userId,
                            verified: false,
                            status: 'failed',
                            reason: blockReason,
                            ip: ip,
                            device: deviceData,
                            hardwareId: hardwareId,
                            secretId: secretId,
                            timestamp: Date.now()
                        });
                        return res.json({ status: 'failed' });
                    }
                }
            }
        }

        // --- SUCCESS SAVE ---
        await set(ref(db, `/${botName}/${userId}`), {
            name: userName,
            userid: userId,
            verified: true,
            status: 'success',
            ip: ip,
            device: deviceData,
            hardwareId: hardwareId, // Save GPU signature
            secretId: secretId,
            timestamp: Date.now()
        });
        
        return res.json({ status: 'success' });

    } catch (error) {
        console.error("Firebase Error:", error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = app;
