require('dotenv').config(); // <-- ADD THIS LINE FIRST
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); 
app.use(express.static('public')); 

// --- DATABASE CONNECTION ---
// You will replace the string below with your actual MongoDB URL later
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB Cloud!"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// --- DATABASE SCHEMA (How data is stored) ---
const teamSchema = new mongoose.Schema({
    teamId: String,
    p1Code: { type: String, default: "" },
    p2Code: { type: String, default: "" }
});
const TeamData = mongoose.model('TeamData', teamSchema);

// --- HARDCODED PASSWORDS ---
const validTeams = {
    "Team_1": "pass123",
    "Team_2": "split24",
    "Team_3": "code99"
};

// --- ROUTES ---
app.post('/login', (req, res) => {
    const { teamId, password } = req.body;
    if (validTeams[teamId] && validTeams[teamId] === password) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials." });
    }
});

app.post('/save', async (req, res) => {
    const { teamId, phase, codeText } = req.body;
    
    if (!validTeams[teamId] || (phase !== 1 && phase !== 2)) {
        return res.status(400).json({ error: "Invalid request." });
    }

    try {
        // Find the team in the database, or create them if it's their first save
        let teamDoc = await TeamData.findOne({ teamId: teamId });
        if (!teamDoc) {
            teamDoc = new TeamData({ teamId: teamId });
        }

        // Save the code to the correct phase
        if (phase === 1) teamDoc.p1Code = codeText;
        if (phase === 2) teamDoc.p2Code = codeText;

        await teamDoc.save(); // Push to the cloud!
        res.json({ success: true });
        
    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: "Failed to save to cloud." });
    }
});

// process.env.PORT is required for Render deployment
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));