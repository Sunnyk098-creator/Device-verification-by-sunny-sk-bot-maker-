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
    // Ab frontend se secretId bhi aa raha hai
    const { botName, userId, userName, ip, deviceData, secretId } = req.body;

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

    // --- DATABASE STRICT SECURITY CHECK ---
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

            // 2. Loop through all verified users to catch Frauds
            for (const [existingUserId, userData] of Object.entries(allUsers)) {
                
                // Hum sirf unhe check karenge jo pehle Success hue the aur jinki ID alag hai
                if (existingUserId !== userId && userData.status === 'success') {
                    
                    // 👉 BLOCK CONDITION: Agar IP same hai YA Secret ID same hai
                    if (userData.ip === ip || userData.secretId === secretId) {
                        
                        // Fake Verification pakdi gayi, Database mein Fail mark karo
                        await set(ref(db, `/${botName}/${userId}`), {
                            name: userName,
                            userid: userId,
                            verified: false,
                            status: 'failed',
                            reason: userData.ip === ip ? 'duplicate_ip_detected' : 'duplicate_secret_id_detected',
                            ip: ip,
                            device: deviceData,
                            secretId: secretId, // Record secret id to analyze frauds later
                            timestamp: Date.now()
                        });
                        return res.json({ status: 'failed' });
                    }
                }
            }
        }

        // --- SUCCESS SAVE ---
        // Sab clean hai, isliye database mein IP aur Secret ID dono save karo future checking ke liye
        await set(ref(db, `/${botName}/${userId}`), {
            name: userName,
            userid: userId,
            verified: true,
            status: 'success',
            ip: ip,
            device: deviceData,
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
