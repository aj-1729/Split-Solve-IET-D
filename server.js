require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); 
app.use(express.static('public'));

// --- DATABASE CONNECTION ---
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB Cloud!"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// --- DATABASE SCHEMA (UPDATED) ---
const teamSchema = new mongoose.Schema({
    teamId: String,
    password: String,
    p1Code: { type: String, default: "" },
    p2Code: { type: String, default: "" },
    // NEW: Cloud Timer Tracking
    currentPhase: { type: String, default: "0" }, 
    phaseEndTime: { type: Number, default: 0 },
    // NEW: The digital wristband
    sessionToken: { type: String, default: "" }
});
const TeamData = mongoose.model('TeamData', teamSchema);

const SECRET_PASSCODE = process.env.ADMIN_PASSCODE; 

// --- ROUTES ---


// NEW ROUTE: Sets the official end time in the cloud
app.post('/set-timer', async (req, res) => {
    const { teamId, phase, durationSeconds } = req.body;
    try {
        // Calculate the exact real-world time this phase ends
        const endTime = Date.now() + (durationSeconds * 1000);
        await TeamData.updateOne({ teamId: teamId }, { 
            currentPhase: phase, 
            phaseEndTime: endTime 
        });
        res.json({ success: true, endTime: endTime });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- UPDATED LOGIN ROUTE ---
app.post('/login', async (req, res) => {
    const { teamId, password } = req.body;
    try {
        const team = await TeamData.findOne({ teamId: teamId });
        
        if (team && team.password === password) {
            if (team.currentPhase === "done") {
                return res.status(403).json({ success: false, message: "Event already completed!" });
            }

            // Generate a random wristband (e.g., "7f8a9b")
            const newToken = Math.random().toString(36).substring(2, 10);
            team.sessionToken = newToken;
            await team.save();

            res.json({ 
                success: true, 
                currentPhase: team.currentPhase,
                phaseEndTime: team.phaseEndTime,
                sessionToken: newToken // Send it to the frontend!
            });
            
        } else {
            res.status(401).json({ success: false, message: "Invalid Team Name or Password." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// --- UPDATED SAVE ROUTE ---
app.post('/save', async (req, res) => {
    // We now expect the frontend to pass the sessionToken
    const { teamId, phase, codeText, nextPhase, nextDurationSeconds, sessionToken } = req.body;
    
    try {
        let teamDoc = await TeamData.findOne({ teamId: teamId });
        if (!teamDoc) return res.status(400).json({ error: "Team not found." });

        // THE SECURITY CHECK: Does this laptop's wristband match the database?
        if (teamDoc.sessionToken !== sessionToken) {
            return res.status(403).json({ 
                success: false, 
                error: "SECURITY ALERT: This team was logged into from another device. Save rejected!" 
            });
        }

        if (phase === 1) teamDoc.p1Code = codeText;
        if (phase === 2) teamDoc.p2Code = codeText;

        const newEndTime = nextDurationSeconds > 0 ? Date.now() + (nextDurationSeconds * 1000) : 0;
        teamDoc.currentPhase = nextPhase;
        teamDoc.phaseEndTime = newEndTime;

        await teamDoc.save(); 
        res.json({ success: true, endTime: newEndTime });
    } catch (err) {
        res.status(500).json({ error: "Failed to save to cloud." });
    }
});

// --- ADMIN ROUTE ---
app.post('/register', async (req, res) => {
    const { teamId, password, adminPass } = req.body; 
    
    if (adminPass !== SECRET_PASSCODE) {
        return res.status(403).json({ success: false, message: "🚨 Access Denied: Incorrect Organizer Passcode." });
    }

    if (!teamId || !password) {
        return res.status(400).json({ success: false, message: "Missing Team Name or Password." });
    }

    try {
        const existingTeam = await TeamData.findOne({ teamId: teamId });
        if (existingTeam) {
            return res.status(400).json({ success: false, message: "Error: This Team Name already exists!" });
        }

        const newTeam = new TeamData({ teamId: teamId, password: password });
        await newTeam.save();
        res.json({ success: true, message: `✅ Team '${teamId}' registered successfully!` });
        
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error while saving." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));