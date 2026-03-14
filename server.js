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

// --- DATABASE SCHEMA ---
const teamSchema = new mongoose.Schema({
    teamId: String,
    p1Code: { type: String, default: "" },
    p2Code: { type: String, default: "" }
});
const TeamData = mongoose.model('TeamData', teamSchema);

// --- ROUTES ---
app.post('/login', (req, res) => {
    const { teamId } = req.body;
    
    // Check if they typed a name, and let them straight in
    if (teamId && teamId.trim() !== "") {
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: "Team Name is required." });
    }
});

app.post('/save', async (req, res) => {
    const { teamId, phase, codeText } = req.body;
    
    // Basic check to make sure the data is formatted correctly
    if (!teamId || (phase !== 1 && phase !== 2)) {
        return res.status(400).json({ error: "Invalid request." });
    }

    try {
        // Find their team folder in the cloud, or create a new one
        let teamDoc = await TeamData.findOne({ teamId: teamId });
        if (!teamDoc) {
            teamDoc = new TeamData({ teamId: teamId });
        }

        // Save the code based on the phase
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