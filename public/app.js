let editorInstance; 
let currentTeam = "";
let currentPhase = 1;
let timerInterval;

const CODING_TIME = 300; // 5 minutes
const EXPLAIN_TIME = 60; // 1 minute

// --- SESSION RESTORE ON PAGE LOAD ---
window.onload = () => {
    restoreSession();
};

function restoreSession() {
    const savedTeam = localStorage.getItem('ss_teamId');
    const savedPhase = localStorage.getItem('ss_phase'); // "1", "switch", or "2"
    const savedEndTime = localStorage.getItem('ss_endTime');

    if (savedTeam && savedPhase && savedEndTime) {
        const timeLeft = Math.floor((parseInt(savedEndTime) - Date.now()) / 1000);

        if (timeLeft > 0) {
            // Valid session found! Skip login and restore UI
            currentTeam = savedTeam;
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('codingScreen').classList.remove('hidden');
            
            initEditor(); // Set up IDE (it will be empty, as requested)

            // Route them to the exact phase they were on
            if (savedPhase === "1") {
                currentPhase = 1;
                startTimer(timeLeft, "coding", true); // true = isResuming
            } 
            else if (savedPhase === "switch") {
                currentPhase = 1;
                document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
                editorInstance.getWrapperElement().classList.add('hidden');
                document.getElementById('actionBtn').classList.add('hidden');
                startTimer(timeLeft, "switching", true);
            } 
            else if (savedPhase === "2") {
                currentPhase = 2;
                document.getElementById('phaseTitle').innerText = "Phase 2: Member 2";
                const btn = document.getElementById('actionBtn');
                btn.innerText = "Final Save";
                btn.classList.remove('hidden');
                startTimer(timeLeft, "coding", true);
            }
        } else {
            // Timer expired while they were gone. Clear corrupted session.
            localStorage.clear();
        }
    }
}

// --- HELPER TO INITIALIZE IDE ---
function initEditor() {
    if (!editorInstance) {
        editorInstance = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
            lineNumbers: true,
            mode: "text/x-c++src", 
            theme: "dracula",
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 4
        });

        editorInstance.on('beforeChange', (instance, change) => {
            if (change.origin === 'paste') {
                change.cancel(); 
                alert("🚨 ANTI-CHEAT WARNING 🚨\n\nCopy-pasting is strictly disabled!");
            }
        });
    } else {
        // If it exists, just clear it out
        editorInstance.setValue("");
    }
}

async function login() {
    const teamId = document.getElementById('teamId').value.trim(); 
    const password = document.getElementById('password').value.trim(); 

    if (!teamId || !password) {
        document.getElementById('loginMessage').innerText = "Please enter both Team Name and Password!";
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId, password }) 
        });

        const data = await response.json();

        if (response.ok && data.success) {
            currentTeam = teamId;
            document.getElementById('loginMessage').innerText = "";
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
        } else {
            document.getElementById('loginMessage').innerText = data.message || "Invalid Team Name or Password.";
        }
    } catch (err) {
        document.getElementById('loginMessage').innerText = "Server error. Is the backend running?";
    }
}

function startPhase1() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('codingScreen').classList.remove('hidden');
    
    initEditor();
    startTimer(CODING_TIME, "coding");
}

function startTimer(duration, mode, isResuming = false) {
    clearInterval(timerInterval);
    let timeLeft = duration;
    
    // --- SAVE STATE TO LOCALSTORAGE ---
    // Only set a new endTime if we are NOT resuming from a refresh
    if (!isResuming) {
        const endTime = Date.now() + (duration * 1000);
        localStorage.setItem('ss_teamId', currentTeam);
        localStorage.setItem('ss_phase', mode === "switching" ? "switch" : currentPhase.toString());
        localStorage.setItem('ss_endTime', endTime);
    }
    
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
    const codeText = editorInstance ? editorInstance.getValue() : "";

    if (currentPhase === 1) {
        document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
        editorInstance.getWrapperElement().classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        
        startTimer(EXPLAIN_TIME, "switching");
        
    } else {
        // Event is entirely finished
        document.getElementById('codingScreen').innerHTML = "<h1 class='glow-text'>Event Completed!</h1><p class='subtitle'>Great job. Your files are safely stored.</p>";
        localStorage.clear(); // WIPE THE SESSION so the next team can use the computer
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

// --- ANTI-CHEAT ---
document.addEventListener('visibilitychange', () => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (document.hidden && isCodingScreenVisible) {
        alert("🚨 WARNING 🚨\n\nTab switching is not allowed during the competition! Stay on this screen.");
    }
});

document.addEventListener('contextmenu', (e) => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (isCodingScreenVisible) {
        e.preventDefault(); 
    }
});

document.addEventListener('copy', (e) => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (isCodingScreenVisible) {
        e.preventDefault();
        alert("🚨 ANTI-CHEAT 🚨\nCopying is disabled!");
    }
});

document.addEventListener('paste', (e) => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (isCodingScreenVisible) {
        e.preventDefault();
    }
});