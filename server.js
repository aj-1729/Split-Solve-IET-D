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
    phaseEndTime: { type: Number, default: 0 } 
});
const TeamData = mongoose.model('TeamData', teamSchema);

const SECRET_PASSCODE = process.env.ADMIN_PASSCODE; 

// --- ROUTES ---

app.post('/login', async (req, res) => {
    const { teamId, password } = req.body;
    try {
        const team = await TeamData.findOne({ teamId: teamId });
        
        if (team && team.password === password) {
            
            // 🚨 THE NEW BOUNCER: Block them if they already finished!
            if (team.currentPhase === "done") {
                return res.status(403).json({ 
                    success: false, 
                    message: "Event already completed! You cannot log in again." 
                });
            }

            // If not done, let them in and send their timer data
            res.json({ 
                success: true, 
                currentPhase: team.currentPhase,
                phaseEndTime: team.phaseEndTime
            });
            
        } else {
            res.status(401).json({ success: false, message: "Invalid Team Name or Password." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});
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

app.post('/save', async (req, res) => {
    const { teamId, phase, codeText, nextPhase, nextDurationSeconds } = req.body;
    
    try {
        let teamDoc = await TeamData.findOne({ teamId: teamId });
        if (!teamDoc) return res.status(400).json({ error: "Team not found." });

        // Save the code
        if (phase === 1) teamDoc.p1Code = codeText;
        if (phase === 2) teamDoc.p2Code = codeText;

        // Update the timer for the *next* phase
        const newEndTime = nextDurationSeconds > 0 ? Date.now() + (nextDurationSeconds * 1000) : 0;
        teamDoc.currentPhase = nextPhase;
        teamDoc.phaseEndTime = newEndTime;

        await teamDoc.save(); 
        res.json({ success: true, endTime: newEndTime });
    } catch (err) {
        console.error("Database Save Error:", err);
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