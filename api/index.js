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
    const { botName, userId, userName, ip, deviceData } = req.body;

    if (!botName || !userId) {
        return res.status(400).json({ error: 'Missing Data' });
    }

    // --- STEP 1: VPN & PROXY DETECTION (Anti-VPN System) ---
    if (ip && ip !== "Unknown") {
        try {
            // Yeh API free mein VPN/Proxy/Cloud Hosting detect karti hai
            const vpnRes = await fetch(`http://ip-api.com/json/${ip}?fields=proxy,hosting`);
            const vpnData = await vpnRes.json();
            
            if (vpnData.proxy || vpnData.hosting) {
                // Agar VPN hai toh Database check karne ki zaroorat hi nahi
                return res.json({ status: 'vpn_detected' });
            }
        } catch (e) {
            console.error("VPN Check Skipped (API Error)", e);
        }
    }

    // --- STEP 2: DATABASE CHECK ---
    try {
        const dbRef = ref(db);
        const botRef = child(dbRef, botName);
        const snapshot = await get(botRef);

        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            
            // Agar khud pehle se verify hai
            if (allUsers[userId] && allUsers[userId].status === 'success') {
                return res.json({ status: 'already_verified' });
            }

            // Multi-Account Check
            for (const [existingUserId, userData] of Object.entries(allUsers)) {
                if (existingUserId !== userId && userData.status === 'success') {
                    
                    // 👉 IP check HATA DIYA (Taaki same ghar ke log verify kar sakein)
                    // Ab sirf Exact Physical Device check hoga (Device + Screen Resolution)
                    if (userData.device === deviceData) {
                        
                        await set(ref(db, `/${botName}/${userId}`), {
                            name: userName,
                            userid: userId,
                            verified: false,
                            status: 'failed',
                            reason: 'duplicate_physical_device',
                            ip: ip,
                            device: deviceData,
                            timestamp: Date.now()
                        });
                        return res.json({ status: 'failed' });
                    }
                }
            }
        }

        // --- STEP 3: SUCCESS SAVE ---
        await set(ref(db, `/${botName}/${userId}`), {
            name: userName,
            userid: userId,
            verified: true,
            status: 'success',
            ip: ip,
            device: deviceData,
            timestamp: Date.now()
        });
        
        return res.json({ status: 'success' });

    } catch (error) {
        console.error("Firebase Error:", error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = app;
