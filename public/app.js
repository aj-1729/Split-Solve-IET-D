let editorInstance; 
let currentTeam = "";
let currentPhase = 1;
let timerInterval;
let currentSessionToken = ""; // Holds our security wristband

const CODING_TIME = 300; // 5 minutes
const EXPLAIN_TIME = 60; // 1 minute

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

        // Anti-paste block
        editorInstance.on('beforeChange', (instance, change) => {
            if (change.origin === 'paste') {
                change.cancel(); 
                alert("🚨 ANTI-CHEAT WARNING 🚨\n\nCopy-pasting is strictly disabled!");
            }
        });

        // NEW: AUTO-SAVE ON EVERY KEYSTROKE
        editorInstance.on('change', () => {
            if (currentTeam) {
                // Saves code to browser memory under their specific team name and phase
                localStorage.setItem(`ss_backup_${currentTeam}_${currentPhase}`, editorInstance.getValue());
            }
        });
    }
}

// NEW HELPER: Loads the backup if it exists
function restoreCodeBackup() {
    const backupCode = localStorage.getItem(`ss_backup_${currentTeam}_${currentPhase}`);
    if (backupCode) {
        editorInstance.setValue(backupCode);
    } else {
        editorInstance.setValue(""); // Start empty if no backup
    }
}

async function login() {
    const teamId = document.getElementById('teamId').value.trim(); 
    const password = document.getElementById('password').value.trim(); 

    if (!teamId || !password) return;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId, password }) 
        });

        const data = await response.json();

        if (response.ok && data.success) {
            currentTeam = teamId;
            
            // 🔒 THE MISSING PIECE: Grab the wristband from the server!
            currentSessionToken = data.sessionToken; 
            
            document.getElementById('loginMessage').innerText = "";
            const now = Date.now();
            
            // SERVER CHECK: Does this team have an active timer running?
            if (data.currentPhase !== "0" && data.currentPhase !== "done" && data.phaseEndTime > now) {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('codingScreen').classList.remove('hidden');
                
                initEditor(); 
                
                // Route them to their exact phase and load their code!
                if (data.currentPhase === "1") {
                    currentPhase = 1;
                    restoreCodeBackup(); // LOAD BACKUP HERE
                    startTimer(data.phaseEndTime, "coding");
                } 
                else if (data.currentPhase === "switch") {
                    currentPhase = 1;
                    document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
                    editorInstance.getWrapperElement().classList.add('hidden');
                    document.getElementById('actionBtn').classList.add('hidden');
                    startTimer(data.phaseEndTime, "switching");
                } 
                else if (data.currentPhase === "2") {
                    currentPhase = 2;
                    document.getElementById('phaseTitle').innerText = "Phase 2: Member 2";
                    const btn = document.getElementById('actionBtn');
                    btn.innerText = "Final Save";
                    btn.classList.remove('hidden');
                    restoreCodeBackup(); // LOAD BACKUP HERE
                    startTimer(data.phaseEndTime, "coding");
                }
            } else if (data.currentPhase === "done") {
                // BOUNCER: Block teams that already finished
                document.getElementById('loginMessage').innerText = "Event already completed! You cannot log in again.";
            } else {
                // Brand new session
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('startScreen').classList.remove('hidden');
            }
        } else {
            document.getElementById('loginMessage').innerText = data.message || "Invalid Team Name or Password.";
        }
    } catch (err) {
        document.getElementById('loginMessage').innerText = "Server error.";
    }
}

async function startPhase1() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('codingScreen').classList.remove('hidden');
    currentPhase = 1;
    
    initEditor();
    restoreCodeBackup(); // Start fresh or load existing
    
    const response = await fetch('/set-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeam, phase: "1", durationSeconds: CODING_TIME })
    });
    const data = await response.json();
    
    startTimer(data.endTime, "coding");
}

function startTimer(absoluteEndTime, mode) {
    clearInterval(timerInterval);
    
    function tick() {
        const timeLeft = Math.floor((absoluteEndTime - Date.now()) / 1000);
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            updateTimerDisplay(0);
            if (mode === "coding") {
                savePhase(); 
            } else if (mode === "switching") {
                startPhase2(); 
            }
        } else {
            updateTimerDisplay(timeLeft);
        }
    }
    
    tick(); 
    timerInterval = setInterval(tick, 1000);
}

function updateTimerDisplay(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').innerText = 
        `Time Left: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function savePhase() { 
    clearInterval(timerInterval);
    const codeText = editorInstance ? editorInstance.getValue() : "";

    // 🧹 CLEANUP: Delete the local backup since we are saving it to the cloud now
    localStorage.removeItem(`ss_backup_${currentTeam}_${currentPhase}`);

    let nextPhase, nextDuration;

    if (currentPhase === 1) {
        document.getElementById('phaseTitle').innerText = "Call your partner and explain everything to him till the time goes off!";
        editorInstance.getWrapperElement().classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        
        nextPhase = "switch";
        nextDuration = EXPLAIN_TIME;
    } else {
        // UI UPGRADE: Uses the new premium CSS classes for the finish screen
        document.getElementById('codingScreen').innerHTML = "<h1 class='hero-title' style='margin-bottom: 20px;'>EVENT COMPLETED</h1><p class='instruction-text'>Great job. Your files are securely locked in the database.</p>";
        nextPhase = "done";
        nextDuration = 0;
    }

    const response = await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            teamId: currentTeam, 
            phase: currentPhase, 
            codeText: codeText,
            nextPhase: nextPhase,
            nextDurationSeconds: nextDuration,
            sessionToken: currentSessionToken // 🔒 THE NEW SECURITY WRISTBAND
        })
    });
    
    const data = await response.json();

    // 🚨 SECURITY CATCH: Kick them out if they saved from another device
    if (!data.success && data.error) {
        alert(data.error);
        window.location.reload(); 
        return;
    }

    if (currentPhase === 1 && data.success) {
        startTimer(data.endTime, "switching");
    }
}

async function startPhase2() {
    currentPhase = 2;
    document.getElementById('phaseTitle').innerText = "Phase 2: Member 2";
    
    editorInstance.getWrapperElement().classList.remove('hidden');
    
    initEditor();
    restoreCodeBackup(); // Load backup or start fresh for Phase 2
    
    setTimeout(() => { editorInstance.refresh(); editorInstance.focus(); }, 10);

    const btn = document.getElementById('actionBtn');
    btn.innerText = "Final Save";
    btn.classList.remove('hidden');
    
    const response = await fetch('/set-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeam, phase: "2", durationSeconds: CODING_TIME })
    });
    const data = await response.json();
    
    startTimer(data.endTime, "coding");
}

// --- ANTI-CHEAT ---
document.addEventListener('visibilitychange', () => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (document.hidden && isCodingScreenVisible) alert("🚨 WARNING 🚨\n\nTab switching is not allowed!");
});
document.addEventListener('contextmenu', (e) => {
    if (!document.getElementById('codingScreen').classList.contains('hidden')) e.preventDefault(); 
});
document.addEventListener('copy', (e) => {
    if (!document.getElementById('codingScreen').classList.contains('hidden')) { e.preventDefault(); alert("🚨 ANTI-CHEAT 🚨\nCopying is disabled!"); }
});
document.addEventListener('paste', (e) => {
    if (!document.getElementById('codingScreen').classList.contains('hidden')) e.preventDefault();
});