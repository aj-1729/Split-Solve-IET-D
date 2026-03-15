let editorInstance; // Stores our IDE
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
        
        // --- INITIALIZE CODEMIRROR IDE ---
        if (!editorInstance) {
            editorInstance = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
                lineNumbers: true,
                mode: "text/x-c++src", // Perfect for competitive programming
                theme: "dracula",
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 4
            });
        }

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

function savePhase() { 
    clearInterval(timerInterval);
    
    // Grab the text from the new CodeMirror IDE
    const codeText = editorInstance.getValue();

    // 1. INSTANT UI UPDATE (The screen changes immediately)
    if (currentPhase === 1) {
        // --- 1 MINUTE EXPLANATION PHASE ---
        document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
        
        // Hide the CodeMirror editor and the save button
        editorInstance.getWrapperElement().classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        
        // Start the automatic 1-minute timer instantly
        startTimer(EXPLAIN_TIME, "switching");
        
    } else {
        // Event finished for this team
        document.getElementById('codingScreen').innerHTML = "<h1 class='glow-text'>Event Completed!</h1><p class='subtitle'>Great job. Your files are safely stored.</p>";
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
    
    // Bring the IDE back to the screen and clear it
    editorInstance.getWrapperElement().classList.remove('hidden');
    editorInstance.setValue(""); 
    
    // Force a tiny visual refresh so the IDE doesn't glitch
    setTimeout(() => {
        editorInstance.refresh();
        editorInstance.focus();
    }, 10);

    // Bring the save button back
    const btn = document.getElementById('actionBtn');
    btn.innerText = "Final Save";
    btn.classList.remove('hidden');
    
    // Automatically start the Phase 2 coding timer
    startTimer(CODING_TIME, "coding");
}

// --- ANTI-CHEAT: SMART PASTE BLOCKER ---
// Attached to the entire document so it never crashes on load
document.addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const PASTE_LIMIT = 50; 

    if (pastedText.length > PASTE_LIMIT) {
        e.preventDefault(); 
        alert(`🚨 ANTI-CHEAT WARNING 🚨\n\nYou cannot paste more than ${PASTE_LIMIT} characters at once. Please type your code manually!`);
    }
});

// --- ANTI-CHEAT: TAB SWITCH DETECTOR ---
document.addEventListener('visibilitychange', () => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (document.hidden && isCodingScreenVisible) {
        alert("🚨 WARNING 🚨\n\nTab switching is not allowed during the competition! Stay on this screen.");
    }
});

// --- ANTI-CHEAT: DISABLE RIGHT CLICK ---
document.addEventListener('contextmenu', (e) => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (isCodingScreenVisible) {
        e.preventDefault(); 
    }
});