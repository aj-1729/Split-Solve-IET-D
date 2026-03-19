let editorInstance; 
let currentTeam = "";
let currentPhase = 1;
let timerInterval;
let currentSessionToken = ""; 

// ⏱️ THE NEW CUSTOM TIMERS (in seconds)
const PHASE_1_TIME = 720; // 12 minutes
const EXPLAIN_TIME = 150; // 2.5 minutes
const PHASE_2_TIME = 600; // 10 minutes

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

        editorInstance.on('change', () => {
            if (currentTeam) {
                localStorage.setItem(`ss_backup_${currentTeam}_${currentPhase}`, editorInstance.getValue());
            }
        });
    }
}

function restoreCodeBackup() {
    const backupCode = localStorage.getItem(`ss_backup_${currentTeam}_${currentPhase}`);
    if (backupCode) {
        editorInstance.setValue(backupCode);
    } else {
        editorInstance.setValue(""); 
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
            currentSessionToken = data.sessionToken; 
            
            document.getElementById('loginMessage').innerText = "";
            const now = Date.now();
            
            if (data.currentPhase !== "0" && data.currentPhase !== "done" && data.phaseEndTime > now) {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('codingScreen').classList.remove('hidden');
                
                initEditor(); 
                
                if (data.currentPhase === "1") {
                    currentPhase = 1;
                    restoreCodeBackup(); 
                    startTimer(data.phaseEndTime, "coding");
                } 
                else if (data.currentPhase === "switch") {
                    currentPhase = 1;
                    document.getElementById('phaseTitle').innerText = "Switch Phase: Explain your code!";
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
                    restoreCodeBackup(); 
                    startTimer(data.phaseEndTime, "coding");
                }
            } else if (data.currentPhase === "done") {
                document.getElementById('loginMessage').innerText = "Event already completed! You cannot log in again.";
            } else {
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
    restoreCodeBackup(); 
    
    const response = await fetch('/set-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Uses the 12-minute timer
        body: JSON.stringify({ teamId: currentTeam, phase: "1", durationSeconds: PHASE_1_TIME })
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
        `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function savePhase() { 
    clearInterval(timerInterval);
    const codeText = editorInstance ? editorInstance.getValue() : "";

    localStorage.removeItem(`ss_backup_${currentTeam}_${currentPhase}`);

    let nextPhase, nextDuration;

    if (currentPhase === 1) {
        document.getElementById('phaseTitle').innerText = "Switch Phase: Explain your code!";
        editorInstance.getWrapperElement().classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        
        nextPhase = "switch";
        // Uses the 2.5-minute timer
        nextDuration = EXPLAIN_TIME;
    } else {
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
            sessionToken: currentSessionToken 
        })
    });
    
    const data = await response.json();

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
    restoreCodeBackup(); 
    
    setTimeout(() => { editorInstance.refresh(); editorInstance.focus(); }, 10);

    const btn = document.getElementById('actionBtn');
    btn.innerText = "Final Save";
    btn.classList.remove('hidden');
    
    const response = await fetch('/set-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Uses the 10-minute timer
        body: JSON.stringify({ teamId: currentTeam, phase: "2", durationSeconds: PHASE_2_TIME })
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