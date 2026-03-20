let editorInstance; 
let currentTeam = "";
let currentRound = 1;
let currentPhase = 1;
let timerInterval;
let currentSessionToken = ""; 

// 🎛️ TOURNAMENT CONFIGURATION (Time in Seconds)
// You can freely edit these numbers to change the times for any round!
const TOURNAMENT_CONFIG = {
    1: { phase1: 600, explain: 120, phase2: 480 }, // Round 1: 10m, 2m, 8m
    2: { phase1: 900, explain: 180, phase2: 600 }, // Round 2: 15m, 3m, 10m
    3: { phase1: 1200, explain: 240,  phase2: 900 }  // Round 3: 20m, 4m, 15m
};

const MAX_ROUNDS = 3;

function initEditor() {
    if (!editorInstance) {
        editorInstance = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
            lineNumbers: true, mode: "text/x-c++src", theme: "dracula",
            autoCloseBrackets: true, matchBrackets: true, indentUnit: 4
        });
        editorInstance.on('beforeChange', (i, c) => {
            if (c.origin === 'paste') { c.cancel(); alert("🚨 ANTI-CHEAT: Copy-pasting disabled!"); }
        });
        editorInstance.on('change', () => {
            if (currentTeam) localStorage.setItem(`ss_backup_${currentTeam}_R${currentRound}_P${currentPhase}`, editorInstance.getValue());
        });
    }
}

function restoreCodeBackup() {
    const backupCode = localStorage.getItem(`ss_backup_${currentTeam}_R${currentRound}_P${currentPhase}`);
    if (backupCode) editorInstance.setValue(backupCode);
    else editorInstance.setValue(""); 
}

// Prepares the UI for the correct round
function showStartScreen(roundNum) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('codingScreen').classList.add('hidden');
    const startScreen = document.getElementById('startScreen');
    startScreen.classList.remove('hidden');
    
    startScreen.querySelector('.section-title').innerText = `Awaiting Sync: ROUND ${roundNum}`;
    startScreen.querySelector('.cyber-btn').innerText = `COMMENCE ROUND ${roundNum}`;
    
    // Auto-update the HTML timer display to match your config!
    const mins = Math.floor(TOURNAMENT_CONFIG[roundNum].phase1 / 60);
    document.getElementById('timer').innerText = `${mins}:00`;
}

async function login() {
    const teamId = document.getElementById('teamId').value.trim(); 
    const password = document.getElementById('password').value.trim(); 
    if (!teamId || !password) return;

    try {
        const response = await fetch('/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId, password }) 
        });
        const data = await response.json();

        if (response.ok && data.success) {
            currentTeam = teamId;
            currentSessionToken = data.sessionToken; 
            currentRound = data.currentRound || 1;
            document.getElementById('loginMessage').innerText = "";
            const now = Date.now();
            
            if (data.currentPhase !== "0" && data.currentPhase !== "done" && data.phaseEndTime > now) {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('codingScreen').classList.remove('hidden');
                initEditor(); 
                
                if (data.currentPhase === "1") {
                    currentPhase = 1; document.getElementById('phaseTitle').innerText = `Round ${currentRound} | Phase 1: Member 1`;
                    restoreCodeBackup(); startTimer(data.phaseEndTime, "coding");
                } 
                else if (data.currentPhase === "switch") {
                    currentPhase = 1; document.getElementById('phaseTitle').innerText = "SWITCH PHASE: Explain your code!";
                    editorInstance.getWrapperElement().classList.add('hidden');
                    document.getElementById('actionBtn').classList.add('hidden');
                    startTimer(data.phaseEndTime, "switching");
                } 
                else if (data.currentPhase === "2") {
                    currentPhase = 2; document.getElementById('phaseTitle').innerText = `Round ${currentRound} | Phase 2: Member 2`;
                    const btn = document.getElementById('actionBtn'); btn.innerText = "Final Save"; btn.classList.remove('hidden');
                    restoreCodeBackup(); startTimer(data.phaseEndTime, "coding");
                }
            } else if (data.currentPhase === "done") {
                document.getElementById('loginMessage').innerText = "Tournament already completed!";
            } else {
                showStartScreen(currentRound); // Drop them at the start screen for their specific round
            }
        } else {
            document.getElementById('loginMessage').innerText = data.message || "Invalid Team Name or Password.";
        }
    } catch (err) { document.getElementById('loginMessage').innerText = "Server error."; }
}

async function startPhase1() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('codingScreen').classList.remove('hidden');
    currentPhase = 1;
    document.getElementById('phaseTitle').innerText = `Round ${currentRound} | Phase 1: Member 1`;
    
    initEditor();
    restoreCodeBackup(); 
    
    const timeLimit = TOURNAMENT_CONFIG[currentRound].phase1;
    
    const response = await fetch('/set-timer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeam, round: currentRound, phase: "1", durationSeconds: timeLimit })
    });
    const data = await response.json();
    startTimer(data.endTime, "coding");
}

function startTimer(absoluteEndTime, mode) {
    clearInterval(timerInterval);
    function tick() {
        const timeLeft = Math.floor((absoluteEndTime - Date.now()) / 1000);
        if (timeLeft <= 0) {
            clearInterval(timerInterval); updateTimerDisplay(0);
            if (mode === "coding") savePhase(); 
            else if (mode === "switching") startPhase2(); 
        } else { updateTimerDisplay(timeLeft); }
    }
    tick(); timerInterval = setInterval(tick, 1000);
}

function updateTimerDisplay(timeLeft) {
    const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60;
    document.getElementById('timer').innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function savePhase() { 
    clearInterval(timerInterval);
    const codeText = editorInstance ? editorInstance.getValue() : "";
    localStorage.removeItem(`ss_backup_${currentTeam}_R${currentRound}_P${currentPhase}`);

    let nextRound = currentRound;
    let nextPhase, nextDuration;

    if (currentPhase === 1) {
        document.getElementById('phaseTitle').innerText = "SWITCH PHASE: Explain your code!";
        editorInstance.getWrapperElement().classList.add('hidden');
        document.getElementById('actionBtn').classList.add('hidden');
        nextPhase = "switch";
        nextDuration = TOURNAMENT_CONFIG[currentRound].explain;
    } else {
        // Phase 2 finished. Do we have another round?
        if (currentRound < MAX_ROUNDS) {
            nextRound = currentRound + 1;
            nextPhase = "0"; // Send them to the waiting lobby for the next round
            nextDuration = 0;
            alert(`✅ Round ${currentRound} Completed! Data secured. Proceeding to Round ${nextRound} lobby.`);
        } else {
            // They finished Round 3!
            document.getElementById('codingScreen').innerHTML = "<h1 class='hero-title' style='margin-bottom: 20px;'>TOURNAMENT COMPLETED</h1><p class='instruction-text'>Outstanding performance. All files secured.</p>";
            nextPhase = "done";
            nextDuration = 0;
        }
    }

    const response = await fetch('/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            teamId: currentTeam, round: currentRound, phase: currentPhase, codeText: codeText,
            nextRound: nextRound, nextPhase: nextPhase, nextDurationSeconds: nextDuration, sessionToken: currentSessionToken 
        })
    });
    const data = await response.json();

    if (!data.success && data.error) { alert(data.error); window.location.reload(); return; }

    if (currentPhase === 1 && data.success) {
        startTimer(data.endTime, "switching");
    } else if (currentPhase === 2 && currentRound < MAX_ROUNDS) {
        // They saved Phase 2, update local tracker and show the lobby for the next round
        currentRound = nextRound;
        showStartScreen(currentRound);
    }
}

async function startPhase2() {
    currentPhase = 2;
    document.getElementById('phaseTitle').innerText = `Round ${currentRound} | Phase 2: Member 2`;
    editorInstance.getWrapperElement().classList.remove('hidden');
    initEditor();
    restoreCodeBackup(); 
    setTimeout(() => { editorInstance.refresh(); editorInstance.focus(); }, 10);

    const btn = document.getElementById('actionBtn');
    btn.innerText = "Final Save"; btn.classList.remove('hidden');
    
    const timeLimit = TOURNAMENT_CONFIG[currentRound].phase2;
    
    const response = await fetch('/set-timer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeam, round: currentRound, phase: "2", durationSeconds: timeLimit })
    });
    const data = await response.json();
    startTimer(data.endTime, "coding");
}

document.addEventListener('visibilitychange', () => {
    const isCodingScreenVisible = !document.getElementById('codingScreen').classList.contains('hidden');
    if (document.hidden && isCodingScreenVisible) alert("🚨 WARNING 🚨\n\nTab switching is not allowed!");
});
document.addEventListener('contextmenu', (e) => { if (!document.getElementById('codingScreen').classList.contains('hidden')) e.preventDefault(); });
document.addEventListener('copy', (e) => { if (!document.getElementById('codingScreen').classList.contains('hidden')) { e.preventDefault(); alert("🚨 ANTI-CHEAT 🚨\nCopying is disabled!"); }});
document.addEventListener('paste', (e) => { if (!document.getElementById('codingScreen').classList.contains('hidden')) e.preventDefault(); });