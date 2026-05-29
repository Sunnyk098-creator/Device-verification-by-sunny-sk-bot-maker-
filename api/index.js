const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, child } = require('firebase/database');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Aapka Secure Firebase Config (Hidden in Backend)
const firebaseConfig = {
    apiKey: "AIzaSyBvlth5mmdNI51eDnfBwLRUZiWTJF_ruqw",
    authDomain: "device-verification-3e162.firebaseapp.com",
    databaseURL: "https://device-verification-3e162-default-rtdb.firebaseio.com",
    projectId: "device-verification-3e162",
    storageBucket: "device-verification-3e162.firebasestorage.app",
    messagingSenderId: "934782597180",
    appId: "1:934782597180:web:7ea629e8ab3466df052b39"
};

// Start Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

app.post('/api/verify', async (req, res) => {
    const { botName, userId, userName, ip, deviceData } = req.body;

    if (!botName || !userId) {
        return res.status(400).json({ error: 'Missing Data' });
    }

    try {
        const dbRef = ref(db);
        const botRef = child(dbRef, botName);
        const snapshot = await get(botRef);

        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            
            // 1. Agar user pehle se verify ho chuka hai
            if (allUsers[userId] && allUsers[userId].status === 'success') {
                return res.json({ status: 'already_verified' });
            }

            // 2. Multi-Account Check (IP aur Device Block)
            for (const [existingUserId, userData] of Object.entries(allUsers)) {
                if (existingUserId !== userId && userData.status === 'success') {
                    // Agar dusre success user ka IP ya Device aapse match karta hai
                    if (userData.ip === ip || userData.device === deviceData) {
                        
                        // Database mein failed status save karo
                        await set(ref(db, `/${botName}/${userId}`), {
                            name: userName,
                            userid: userId,
                            verified: false,
                            status: 'failed',
                            reason: 'duplicate_ip_or_device_used',
                            ip: ip,
                            device: deviceData,
                            timestamp: Date.now()
                        });
                        return res.json({ status: 'failed' });
                    }
                }
            }
        }

        // 3. Agar IP/Device naya hai, toh Success save karo
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

// Vercel Serverless Setup (app.listen() nahi aayega)
module.exports = app;
