require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 1. Paste your MongoDB URL here again!
const mongoURI = process.env.MONGO_URI;

// 2. Define the schema so it knows how to read the data
const teamSchema = new mongoose.Schema({
    teamId: String,
    p1Code: String,
    p2Code: String
});
const TeamData = mongoose.model('TeamData', teamSchema);

async function downloadAndOrganize() {
    try {
        console.log("Connecting to cloud database...");
        await mongoose.connect(mongoURI);
        console.log("✅ Connected! Downloading team data...\n");

        // Fetch all the teams from the database
        const allTeams = await TeamData.find();

        // Ensure the main 'teams' folder exists locally
        const baseDir = path.join(__dirname, 'final_results');
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

        // Loop through each team and create their folder and files
        for (let team of allTeams) {
            const teamFolder = path.join(baseDir, team.teamId);
            
            // Create the Team folder (e.g., final_results/Team_1)
            if (!fs.existsSync(teamFolder)) fs.mkdirSync(teamFolder);

            // Create p1.txt and p2.txt
            const p1Code = team.p1Code || "";
            const p2Code = team.p2Code || "";
            
            fs.writeFileSync(path.join(teamFolder, 'p1.txt'), p1Code);
            fs.writeFileSync(path.join(teamFolder, 'p2.txt'), p2Code);

            // Create the merged file for the judges
            const finalCode = p1Code + "\n// --- SWITCH ---\n" + p2Code;
            fs.writeFileSync(path.join(teamFolder, 'final_merged.txt'), finalCode);

            console.log(`📁 Saved files for ${team.teamId}`);
        }

        console.log("\n🎉 All done! Check the 'final_results' folder.");
        process.exit();

    } catch (err) {
        console.error("Error downloading data:", err);
        process.exit(1);
    }
}

downloadAndOrganize();