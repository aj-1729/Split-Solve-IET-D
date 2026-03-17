require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); 
app.use(express.static('public')); // This is why index.html must be in the 'public' folder

// --- DATABASE CONNECTION ---
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB Cloud!"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// --- DATABASE SCHEMA ---
const teamSchema = new mongoose.Schema({
    teamId: String,
    password: String,
    p1Code: { type: String, default: "" },
    p2Code: { type: String, default: "" }
});
const TeamData = mongoose.model('TeamData', teamSchema);

// --- MANUAL TEAM CREDENTIALS ---
const registeredTeams = [
    { teamId: "team_alpha", password: "pass_alpha123" },
    { teamId: "team_beta", password: "pass_beta456" },
    { teamId: "admin", password: "admin" } // Use this to test!
];

// --- ROUTES ---
app.post('/login', async (req, res) => {
    const { teamId, password } = req.body;
    try {
        const team = await TeamData.findOne({ teamId: teamId, password: password });
        if (team) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: "Invalid Team Name or Password." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});


app.post('/save', async (req, res) => {
    const { teamId, phase, codeText } = req.body;
    
    if (!teamId || (phase !== 1 && phase !== 2)) {
        return res.status(400).json({ error: "Invalid request." });
    }

    try {
        let teamDoc = await TeamData.findOne({ teamId: teamId });
        if (!teamDoc) {
            teamDoc = new TeamData({ teamId: teamId });
        }

        if (phase === 1) teamDoc.p1Code = codeText;
        if (phase === 2) teamDoc.p2Code = codeText;

        await teamDoc.save(); 
        res.json({ success: true });
        
    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: "Failed to save to cloud." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));