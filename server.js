require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); 
app.use(express.static('public'));

const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB Cloud!"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// 🏆 UPGRADED TOURNAMENT SCHEMA
const teamSchema = new mongoose.Schema({
    teamId: String,
    password: String,
    // Vault for all 3 rounds of code
    codeFiles: { type: Object, default: {} }, 
    
    currentRound: { type: Number, default: 1 }, // Tracks which round they are in
    currentPhase: { type: String, default: "0" }, 
    phaseEndTime: { type: Number, default: 0 },
    sessionToken: { type: String, default: "" } 
});
const TeamData = mongoose.model('TeamData', teamSchema);

const SECRET_PASSCODE = process.env.ADMIN_PASSCODE; 

// --- ROUTES ---

app.post('/login', async (req, res) => {
    const { teamId, password } = req.body;
    try {
        const team = await TeamData.findOne({ teamId: teamId });
        
        if (team && team.password === password) {
            if (team.currentPhase === "done") {
                return res.status(403).json({ success: false, message: "Tournament already completed!" });
            }

            const newToken = Math.random().toString(36).substring(2, 10);
            team.sessionToken = newToken;
            await team.save();

            res.json({ 
                success: true, 
                currentRound: team.currentRound, // Send round data to frontend
                currentPhase: team.currentPhase,
                phaseEndTime: team.phaseEndTime,
                sessionToken: newToken
            });
            
        } else {
            res.status(401).json({ success: false, message: "Invalid Team Name or Password." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

app.post('/set-timer', async (req, res) => {
    const { teamId, round, phase, durationSeconds } = req.body;
    try {
        const endTime = Date.now() + (durationSeconds * 1000);
        await TeamData.updateOne({ teamId: teamId }, { 
            currentRound: round,
            currentPhase: phase, 
            phaseEndTime: endTime 
        });
        res.json({ success: true, endTime: endTime });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/save', async (req, res) => {
    const { teamId, round, phase, codeText, nextRound, nextPhase, nextDurationSeconds, sessionToken } = req.body;
    
    try {
        let teamDoc = await TeamData.findOne({ teamId: teamId });
        if (!teamDoc) return res.status(400).json({ error: "Team not found." });

        if (teamDoc.sessionToken !== sessionToken) {
            return res.status(403).json({ success: false, error: "SECURITY ALERT: This team was logged into from another device." });
        }

        // 💾 Saves code dynamically: e.g., "R1_P1", "R2_P2"
        const fileKey = `R${round}_P${phase}`;
        teamDoc.codeFiles = { ...teamDoc.codeFiles, [fileKey]: codeText };
        teamDoc.markModified('codeFiles');

        const newEndTime = nextDurationSeconds > 0 ? Date.now() + (nextDurationSeconds * 1000) : 0;
        
        teamDoc.currentRound = nextRound;
        teamDoc.currentPhase = nextPhase;
        teamDoc.phaseEndTime = newEndTime;

        await teamDoc.save(); 
        res.json({ success: true, endTime: newEndTime });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save to cloud." });
    }
});

// Admin Register Route
app.post('/register', async (req, res) => {
    const { teamId, password, adminPass } = req.body; 
    if (adminPass !== SECRET_PASSCODE) return res.status(403).json({ success: false, message: "🚨 Access Denied." });
    if (!teamId || !password) return res.status(400).json({ success: false, message: "Missing Data." });

    try {
        const existingTeam = await TeamData.findOne({ teamId: teamId });
        if (existingTeam) return res.status(400).json({ success: false, message: "Team Name exists!" });

        const newTeam = new TeamData({ teamId: teamId, password: password });
        await newTeam.save();
        res.json({ success: true, message: `✅ Team '${teamId}' registered!` });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));