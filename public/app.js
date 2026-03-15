let currentTeam = "";
let currentPhase = 1;
let timerInterval;

// Times in seconds
const CODING_TIME = 300; // 5 minutes
const EXPLAIN_TIME = 60; // 1 minute

async function login() {
    // .trim() removes accidental spaces at the beginning or end
    const teamId = document.getElementById('teamId').value.trim(); 

    if (!teamId) {
        document.getElementById('loginMessage').innerText = "Please enter a Team Name!";
        return;
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }) // Only sending teamId now!
    });

    if (response.ok) {
        currentTeam = teamId;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('codingScreen').classList.remove('hidden');
        startTimer(CODING_TIME, "coding");
    } else {
        document.getElementById('loginMessage').innerText = "Error starting event.";
    }
}
function startTimer(duration, mode) {
    clearInterval(timerInterval);
    let timeLeft = duration;
    
    // Update the clock immediately before the 1-second delay starts
    updateTimerDisplay(timeLeft);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (mode === "coding") {
                savePhase(); // Auto-save triggered here!
            } else if (mode === "switching") {
                startPhase2(); // Auto-start Phase 2 triggered here!
            }
        }
    }, 1000);
}

function updateTimerDisplay(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').innerText = 
        `Time Left: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Notice we removed the word 'async' from the function definition
function savePhase() { 
    clearInterval(timerInterval);
    const codeEditor = document.getElementById('codeEditor');
    const codeText = codeEditor.value;

    // 1. INSTANT UI UPDATE (The screen changes immediately)
    if (currentPhase === 1) {
        // --- 1 MINUTE EXPLANATION PHASE ---
        document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
        
        // Completely hide the text box and the save button
        codeEditor.classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        
        // Start the automatic 1-minute timer instantly
        startTimer(EXPLAIN_TIME, "switching");
        
    } else {
        // Event finished for this team
        document.getElementById('codingScreen').innerHTML = "<h1>Event Completed!</h1><p>Great job. Your files are safely stored.</p>";
    }

    // 2. BACKGROUND SAVE (This happens invisibly without freezing the screen)
    fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeam, phase: currentPhase, codeText })
    }).catch(err => console.error("Background save error:", err));
}

function startPhase2() {
    currentPhase = 2;
    document.getElementById('phaseTitle').innerText = "Phase 2: Member 2";
    
    // Bring the text box back to the screen and clear it
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.classList.remove('hidden');
    codeEditor.value = ""; 
    codeEditor.focus();

    // Bring the save button back
    const btn = document.getElementById('actionBtn');
    btn.innerText = "Final Save";
    btn.classList.remove('hidden');
    
    // Automatically start the Phase 2 coding timer
    startTimer(CODING_TIME, "coding");
}

// --- ANTI-CHEAT: SMART PASTE BLOCKER ---
const codeEditor = document.getElementById('codeEditor');

codeEditor.addEventListener('paste', (e) => {
    // Get the text they are trying to paste
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    
    // Set your character limit (e.g., 50 characters)
    const PASTE_LIMIT = 50; 

    if (pastedText.length > PASTE_LIMIT) {
        e.preventDefault(); // This physically stops the paste from happening
        alert(`🚨 ANTI-CHEAT WARNING 🚨\n\nYou cannot paste more than ${PASTE_LIMIT} characters at once. Please type your code manually!`);
    }
});