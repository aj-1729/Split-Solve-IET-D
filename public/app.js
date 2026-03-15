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

            // --- ANTI-CHEAT: IDE PASTE BLOCKER ---
            // This is attached directly to the editor the moment it is created!
            editorInstance.on('beforeChange', (instance, change) => {
                if (change.origin === 'paste') {
                    // Combine all pasted lines into one string to count the length
                    const pastedText = change.text.join('\n');
                    const PASTE_LIMIT = 50; 

                    if (pastedText.length > PASTE_LIMIT) {
                        change.cancel(); // Physically blocks the paste
                        alert(`🚨 ANTI-CHEAT WARNING 🚨\n\nYou cannot paste more than ${PASTE_LIMIT} characters!`);
                    }
                }
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
    
    updateTimerDisplay(timeLeft);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (mode === "coding") {
                savePhase(); 
            } else if (mode === "switching") {
                startPhase2(); 
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
    
    const codeText = editorInstance.getValue();

    if (currentPhase === 1) {
        document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
        
        editorInstance.getWrapperElement().classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        
        startTimer(EXPLAIN_TIME, "switching");
        
    } else {
        document.getElementById('codingScreen').innerHTML = "<h1 class='glow-text'>Event Completed!</h1><p class='subtitle'>Great job. Your files are safely stored.</p>";
    }

    fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeam, phase: currentPhase, codeText })
    }).catch(err => console.error("Background save error:", err));
}

function startPhase2() {
    currentPhase = 2;
    document.getElementById('phaseTitle').innerText = "Phase 2: Member 2";
    
    editorInstance.getWrapperElement().classList.remove('hidden');
    editorInstance.setValue(""); 
    
    setTimeout(() => {
        editorInstance.refresh();
        editorInstance.focus();
    }, 10);

    const btn = document.getElementById('actionBtn');
    btn.innerText = "Final Save";
    btn.classList.remove('hidden');
    
    startTimer(CODING_TIME, "coding");
}

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