// Game Main Engine States
let currentGameMode = ''; 
let aiDifficulty = 'beginner'; 
let localPlayerName = 'RIYANSHU';
let activeRoomCode = '';
let activeRoomName = '';

// P2P PeerJS Configuration Settings
let peerInstance = null;
let activeConnection = null;
let isHostInstance = false;
let connectedPeerName = '';

// Board Arena Mapping Layout Configurations
const GRID_SIZE = 10;
const TILE_DIM = 80;
let tilesData = [];
let playersArray = [];
const localPlayerId = 'p_local';
const peerPlayerId = 'p_peer';

let currentRoundColor = '';
let gameTimer = 20;
let timerInterval = null;
let gameLoopInterval = null;
let matchmakingTimer = null;
let isRoundActive = false;
let totalAlivePlayers = 20;
let spectatingTargetId = localPlayerId;

// Map Smooth LERP Cam Tracking States
let targetCamAngleX = 55;
let targetCamAngleZ = 0;
let currentCamAngleX = 55;
let currentCamAngleZ = 0;

const COLORS_POOL = ['#f44336', '#3f51b5', '#4caf50', '#ffeb3b', '#9c27b0', '#ff9800'];
const COLOR_NAMES = { '#f44336': 'RED', '#3f51b5': 'BLUE', '#4caf50': 'GREEN', '#ffeb3b': 'YELLOW', '#9c27b0': 'PURPLE', '#ff9800': 'ORANGE' };

// Direct Screen Switching Framework without start notice popups
function triggerModeSelection(targetScreenId, modeContext = '') {
    let docEl = document.documentElement;
    if (docEl.requestFullscreen) { docEl.requestFullscreen(); }
    else if (docEl.webkitRequestFullscreen) { docEl.webkitRequestFullscreen(); }
    
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => console.log("Landscape locked dynamically"));
    }
    showScreen(targetScreenId, modeContext);
}

function showScreen(screenId, modeContext = '') {
    document.querySelectorAll('.screen-overlay, #game-screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    if (modeContext) {
        currentGameMode = modeContext;
        document.getElementById('friend-options').classList.toggle('hidden', modeContext !== 'friend');
        document.getElementById('start-matchmaking-btn').classList.toggle('hidden', modeContext !== 'pvp');
    }
}

// ==========================================
// PEER-TO-PEER (P2P) MULTIPLAYER CODES ENGINE
// ==========================================
function initPeerJSEngine(callback) {
    if (peerInstance) return callback();
    
    let customPeerId = 'CC2D-' + Math.floor(1000 + Math.random() * 9000);
    activeRoomCode = customPeerId.split('-')[1];
    peerInstance = new Peer(customPeerId);
    
    peerInstance.on('open', () => callback());
    peerInstance.on('connection', (conn) => {
        activeConnection = conn; isHostInstance = true; setupP2PDataChannels();
    });
    peerInstance.on('error', () => exitToMenu());
}

function hostFriendRoom() {
    const name = document.getElementById('username-input').value.trim();
    const rName = document.getElementById('room-name-input').value.trim();
    if(!name || !rName) return alert("Please fill up all input blanks!");
    
    localPlayerName = name.toUpperCase();
    activeRoomName = rName.toUpperCase();
    showScreen('lobby-screen');
    document.getElementById('lobby-status').innerText = "CREATING CONNECTIVITY LINK...";
    
    initPeerJSEngine(() => {
        const infoBox = document.getElementById('room-info-display');
        infoBox.classList.remove('hidden');
        infoBox.innerHTML = `ROOM: ${activeRoomName}<br>ROOM CODE: <span style="color:#ffff00; font-size:1.2rem;">${activeRoomCode}</span>`;
        document.getElementById('lobby-status').innerText = "AWAITING FRIEND UNTIL JOINING...";
        document.getElementById('player-list-lobby').innerHTML = `<div style="color:#00ffcc">• ${localPlayerName} (PLAYER 1)</div>`;
    });
}

function connectToFriendRoom() {
    const name = document.getElementById('username-input').value.trim();
    const code = document.getElementById('join-code-input').value.trim();
    if(!name || code.length !== 4) return alert("Please insert 4-Digit valid code key!");
    
    localPlayerName = name.toUpperCase();
    activeRoomCode = code; isHostInstance = false;
    showScreen('lobby-screen');
    document.getElementById('lobby-status').innerText = "SEARCHING ROOM...";

    initPeerJSEngine(() => {
        activeConnection = peerInstance.connect('CC2D-' + activeRoomCode);
        setupP2PDataChannels();
    });
}

function setupP2PDataChannels() {
    activeConnection.on('open', () => {
        activeConnection.send({ type: 'handshake', name: localPlayerName });
    });

    activeConnection.on('data', (data) => {
        if (data.type === 'handshake') {
            connectedPeerName = data.name.toUpperCase();
            document.getElementById('lobby-status').innerText = "CONNECTION ESTABLISHED!";
            if (isHostInstance) {
                document.getElementById('player-list-lobby').innerHTML = `
                    <div style="color:#00ffcc">• ${localPlayerName} (PLAYER 1)</div>
                    <div style="color:#ffff00">• ${connectedPeerName} (PLAYER 2)</div>`;
                document.getElementById('start-p2p-game-btn').classList.remove('hidden');
            } else {
                document.getElementById('player-list-lobby').innerHTML = `
                    <div style="color:#ffff00">• ${connectedPeerName} (PLAYER 1)</div>
                    <div style="color:#00ffcc">• ${localPlayerName} (PLAYER 2)</div>`;
                document.getElementById('lobby-status').innerText = "AWAITING HOST TO START THE ROOM GAME...";
            }
        }
        if (data.type === 'launch_game') { aiDifficulty = 'intermediate'; initGameEngine(); }
        if (data.type === 'sync_coordinates') {
            let remotePeer = playersArray.find(p => p.id === peerPlayerId);
            if (remotePeer) {
                remotePeer.x = data.x; remotePeer.y = data.y; remotePeer.z = data.z; remotePeer.alive = data.alive;
            }
        }
        if (data.type === 'sync_level') {
            currentRoundColor = data.targetColor; applyForcedServerTileLayout(data.layoutData); executeNetworkRoundTimerStart();
        }
        if (data.type === 'sync_elimination') {
            let targetPlayer = playersArray.find(p => p.id === data.targetId);
            if (targetPlayer && targetPlayer.alive) eliminatePlayerProfileNode(targetPlayer);
        }
    });
    activeConnection.on('close', () => exitToMenu());
}

function broadcastGameLaunchSignal() { if(activeConnection) { activeConnection.send({ type: 'launch_game' }); initGameEngine(); } }

function startMatchmakingLoop() {
    const name = document.getElementById('username-input').value.trim();
    if(!name) return alert("Please type your username nickname!");
    localPlayerName = name.toUpperCase();
    showScreen('lobby-screen');
    document.getElementById('room-info-display').classList.add('hidden');
    document.getElementById('lobby-status').innerText = "SEARCHING ONLINE PLAYERS...";
    
    let bar = document.getElementById('lobby-progress-bar');
    let duration = 0; bar.style.width = '0%';

    if (matchmakingTimer) clearInterval(matchmakingTimer);
    matchmakingTimer = setInterval(() => {
        duration += 0.1; bar.style.width = `${(duration / 20) * 100}%`;
        if (duration >= 20) { clearInterval(matchmakingTimer); showScreen('server-error-screen'); }
    }, 100);
}

function retryMatchmaking() { startMatchmakingLoop(); }
function startAIMode(diff) { aiDifficulty = diff; localPlayerName = "RIYANSHU (YOU)"; initGameEngine(); }

// ==========================================
// GRID GENERATOR & PLAYER INJECTION ARCHITECTURE
// ==========================================
function initGameEngine() {
    showScreen('game-screen');
    const map = document.getElementById('game-map');
    map.innerHTML = ''; tilesData = []; playersArray = []; totalAlivePlayers = 20; spectatingTargetId = localPlayer
