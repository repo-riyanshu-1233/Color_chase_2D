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
    map.innerHTML = ''; tilesData = []; playersArray = []; totalAlivePlayers = 20; spectatingTargetId = localPlayerId;
    currentCamAngleX = 55; currentCamAngleZ = 0; targetCamAngleX = 55; targetCamAngleZ = 0;
    document.getElementById('spectator-controls').classList.add('hidden');

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile'; tile.style.left = `${col * TILE_DIM}px`; tile.style.top = `${row * TILE_DIM}px`;
            tile.dataset.id = `t_${row}_${col}`; map.appendChild(tile);
            tilesData.push({ id: tile.dataset.id, element: tile, color: '#2d1e47', capturedBy: null });
        }
    }

    playersArray.push({ id: localPlayerId, name: localPlayerName, x: 385, y: 600, z: 0, isBot: false, alive: true, element: createEntityNode(localPlayerName, 'local-player') });

    let totalAIBots = 19;
    if (currentGameMode === 'friend' && activeConnection) {
        playersArray.push({ id: peerPlayerId, name: connectedPeerName, x: 420, y: 600, z: 0, isBot: false, alive: true, element: createEntityNode(connectedPeerName, 'peer-player') });
        totalAIBots = 18;
    }

    for(let i = 1; i <= totalAIBots; i++) {
        let nameTag = `BOT_${i}`;
        playersArray.push({ id: `b_${i}`, name: nameTag, x: Math.random() * 700 + 50, y: Math.random() * 550 + 50, z: 0, isBot: true, alive: true, element: createEntityNode(nameTag, 'bot') });
    }

    updateAliveDisplayHUD();

    // Reset directions state securely
    moveDirectionsState = { up: false, down: false, left: false, right: false };

    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(runEnginePhysicsTick, 1000 / 60);

    if (currentGameMode !== 'friend' || isHostInstance) startNextRoundLoop();
}

function createEntityNode(name, variantClass) {
    const map = document.getElementById('game-map');
    const node = document.createElement('div'); node.className = `entity ${variantClass}`;
    const label = document.createElement('div'); label.className = 'entity-name'; label.innerText = name;
    node.appendChild(label); map.appendChild(node);
    return node;
}

// ==========================================
// DYNAMIC CONTINUOUS BUTTON PRESS OVERRIDE
// ==========================================
let moveDirectionsState = { up: false, down: false, left: false, right: false };

// Fixed high-performance continuous touch registrar
function handleButtonTouch(e, direction, isActive) {
    if (e) {
        e.preventDefault(); // Mobile browsers default browser scrolling halt karta hai
    }
    if (moveDirectionsState.hasOwnProperty(direction)) {
        moveDirectionsState[direction] = isActive;
    }
}

function handleJumpTouch(e) {
    if (e) e.preventDefault();
    triggerLocalPlayerJump();
}

// Keyboard Hardware Button Hooks (Dono mobile button aur computer buttons side by side chalenge)
let keyboardKeyMap = { 'w': 'up', 'arrowup': 'up', 's': 'down', 'arrowdown': 'down', 'a': 'left', 'arrowleft': 'left', 'd': 'right', 'arrowright': 'right' };
window.onkeydown = (e) => { let d = keyboardKeyMap[e.key.toLowerCase()]; if(d) moveDirectionsState[d] = true; if(e.key === ' ') triggerLocalPlayerJump(); };
window.onkeyup = (e) => { let d = keyboardKeyMap[e.key.toLowerCase()]; if(d) moveDirectionsState[d] = false; };

function triggerLocalPlayerJump() {
    let hero = playersArray.find(p => p.id === localPlayerId);
    if (hero && hero.alive && hero.z === 0) hero.z = 16;
}

// ==========================================
// SIMULATION FRAMEPHYSICS ENGINE TICK
// ==========================================
function runEnginePhysicsTick() {
    const runVelocity = 4.6;
    let hero = playersArray.find(p => p.id === localPlayerId);

    if (hero && hero.alive) {
        let dx = 0; let dy = 0;
        if (moveDirectionsState.up) dy -= runVelocity;
        if (moveDirectionsState.down) dy += runVelocity;
        if (moveDirectionsState.left) dx -= runVelocity;
        if (moveDirectionsState.right) dx += runVelocity;

        hero.x += dx; hero.y += dy;
        hero.x = Math.max(4, Math.min(760, hero.x));
        hero.y = Math.max(4, Math.min(760, hero.y));

        if (currentGameMode === 'friend' && activeConnection) {
            activeConnection.send({ type: 'sync_coordinates', x: hero.x, y: hero.y, z: hero.z, alive: hero.alive });
        }
    }

    // MAP DYNAMIC ROTATION MATHEMATICS (DYNAMIC CAMERA POSITION)
    let targetSubject = playersArray.find(p => p.id === spectatingTargetId);
    if (targetSubject && targetSubject.alive) {
        let normX = (targetSubject.x - 400) / 400; 
        let normY = (targetSubject.y - 400) / 400; 
        targetCamAngleX = 54 + (normY * 12); 
        targetCamAngleZ = -(normX * 22); 
    } else {
        targetCamAngleX = 55; targetCamAngleZ = 0;
    }

    // Camera Interpolation LERP
    currentCamAngleX += (targetCamAngleX - currentCamAngleX) * 0.08;
    currentCamAngleZ += (targetCamAngleZ - currentCamAngleZ) * 0.08;

    let mapNode = document.getElementById('game-map');
    if (mapNode) mapNode.style.transform = `rotateX(${currentCamAngleX}deg) rotateZ(${currentCamAngleZ}deg)`;

    // Process Character Height Jumps & Bot Decisions
    playersArray.forEach(p => {
        if (!p.alive) return;

        if (p.z > 0) { p.z -= 0.8; if (p.z < 0) p.z = 0; }

        if (p.isBot && isRoundActive && (currentGameMode !== 'friend' || isHostInstance)) {
            executeAdvancedBotAIPhysics(p);
        }

        p.element.style.left = `${p.x}px`;
        p.element.style.top = `${p.y}px`;
        p.element.style.transform = `translateZ(${14 + p.z}px)`;

        let col = Math.floor((p.x + 16) / TILE_DIM);
        let row = Math.floor((p.y + 16) / TILE_DIM);
        let currentTile = tilesData.find(t => t.id === `t_${row}_${col}`);

        if (currentTile && isRoundActive && currentTile.color === currentRoundColor && p.z === 0) {
            if (currentTile.capturedBy === null || currentTile.capturedBy === p.id) {
                tilesData.forEach(t => { if(t.capturedBy === p.id) { t.capturedBy = null; t.element.style.border = '4px solid #140d24'; } });
                currentTile.capturedBy = p.id;
                currentTile.element.style.border = `4px dashed ${p.isBot ? '#ff3333' : '#00ffcc'}`;
            }
        }
    });
}

function executeAdvancedBotAIPhysics(bot) {
    let tiles = tilesData.filter(t => t.color === currentRoundColor && (t.capturedBy === null || t.capturedBy === bot.id));
    if (tiles.length === 0) return;

    let targetTile = tiles[0]; let minD = Infinity;
    tiles.forEach(t => {
        let d = Math.hypot((parseInt(t.element.style.left)+40)-bot.x, (parseInt(t.element.style.top)+40)-bot.y);
        if(d < minD) { minD = d; targetTile = t; }
    });

    let tx = parseInt(targetTile.element.style.left) + 20;
    let ty = parseInt(targetTile.element.style.top) + 20;
    let speed = aiDifficulty === 'beginner' ? 2.2 : (aiDifficulty === 'master' ? 4.8 : 3.5);

    if (Math.abs(bot.x - tx) > 4) bot.x += bot.x < tx ? speed : -speed;
    if (Math.abs(bot.y - ty) > 4) bot.y += bot.y < ty ? speed : -speed;
}

// ==========================================
// CORE ARCADE TIMERS ROUND MANAGEMENT
// ==========================================
function startNextRoundLoop() {
    isRoundActive = false; currentRoundColor = '';
    document.getElementById('target-color-display').innerText = "ROLLING BOARD GAME TILES...";
    document.getElementById('target-color-display').style.color = '#ffffff';

    tilesData.forEach(t => {
        t.color = '#2d1e47'; t.capturedBy = null; t.element.className = 'tile';
        t.element.style.backgroundColor = '#2d1e47'; t.element.style.border = '4px solid #140d24';
    });

    setTimeout(() => {
        let allowedLimit = totalAlivePlayers - 1;
        currentRoundColor = COLORS_POOL[Math.floor(Math.random() * COLORS_POOL.length)];
        
        let trackingLayoutArray = [];
        let shuffled = [...tilesData].sort(() => 0.5 - Math.random());
        let colored = 0;

        shuffled.forEach(t => {
            let assignedColor = '';
            if (colored < allowedLimit) { assignedColor = currentRoundColor; colored++; } 
            else {
                let pool = COLORS_POOL.filter(c => c !== currentRoundColor);
                assignedColor = pool[Math.floor(Math.random() * pool.length)];
            }
            t.color = assignedColor; t.element.style.backgroundColor = assignedColor;
            trackingLayoutArray.push({ id: t.id, color: assignedColor });
        });

        if (currentGameMode === 'friend' && activeConnection && isHostInstance) {
            activeConnection.send({ type: 'sync_level', targetColor: currentRoundColor, layoutData: trackingLayoutArray });
        }
        executeNetworkRoundTimerStart();
    }, 3000);
}

function applyForcedServerTileLayout(layoutData) {
    layoutData.forEach(data => {
        let tile = tilesData.find(t => t.id === data.id);
        if (tile) { tile.color = data.color; tile.element.style.backgroundColor = data.color; }
    });
}

function executeNetworkRoundTimerStart() {
    isRoundActive = true; gameTimer = 20;
    document.getElementById('target-color-display').innerText = `RUN TO: ${COLOR_NAMES[currentRoundColor]}!`;
    document.getElementById('target-color-display').style.color = currentRoundColor;
    document.getElementById('timer-display').innerText = `${gameTimer}s`;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        gameTimer--; document.getElementById('timer-display').innerText = `${gameTimer}s`;
        if (gameTimer <= 0) { 
            clearInterval(timerInterval); 
            if (currentGameMode !== 'friend' || isHostInstance) processRoundCollapseSequence(); 
        }
    }, 1000);
}

function processRoundCollapseSequence() {
    isRoundActive = false;
    tilesData.forEach(t => { if (t.color !== currentRoundColor || t.capturedBy === null) t.element.classList.add('falling'); });

    setTimeout(() => {
        playersArray.forEach(p => {
            if (!p.alive) return;
            let col = Math.floor((p.x + 16) / TILE_DIM);
            let row = Math.floor((p.y + 16) / TILE_DIM);
            let tile = tilesData.find(t => t.id === `t_${row}_${col}`);

            if (!tile || tile.color !== currentRoundColor || tile.capturedBy !== p.id) {
                eliminatePlayerProfileNode(p);
                if (currentGameMode === 'friend' && activeConnection && isHostInstance) {
                    activeConnection.send({ type: 'sync_elimination', targetId: p.id });
                }
            }
        });

        updateAliveDisplayHUD();
        let survivors = playersArray.filter(p => p.alive);
        
        if (survivors.length <= 1) {
            clearInterval(gameLoopInterval);
            let winName = survivors.length === 1 ? survivors[0].name : "NOBODY";
            alert(`MATCH OVER! WINNER IS: ${winName}`);
            exitToMenu();
        } else {
            startNextRoundLoop();
        }
    }, 1200);
}

function eliminatePlayerProfileNode(player) {
    player.alive = false;
    player.element.style.transition = 'transform 1s, opacity 1s';
    player.element.style.transform = 'scale(0) translateZ(-500px)';
    player.element.style.opacity = '0';
    totalAlivePlayers--;

    const container = document.getElementById('notification-area');
    const noticeNode = document.createElement('div'); noticeNode.className = 'notif';
    noticeNode.innerText = `${player.name} OUT!`; container.appendChild(noticeNode);

    if (player.id === localPlayerId) {
        document.getElementById('spectator-controls').classList.remove('hidden');
        spectateNextEntity();
    }
}

// Safe global window-level release hook agar touch screen se baahar slip ho jaaye to player instantly ruk jaaye
window.addEventListener('pointerup', () => {
    moveDirectionsState = { up: false, down: false, left: false, right: false };
});
window.addEventListener('pointercancel', () => {
    moveDirectionsState = { up: false, down: false, left: false, right: false };
});

function spectateNextEntity() {
    let alive = playersArray.filter(p => p.alive); if(alive.length === 0) return;
    let idx = alive.findIndex(p => p.id === spectatingTargetId);
    spectatingTargetId = alive[(idx + 1) % alive.length].id;
    document.getElementById('spectator-msg').innerText = `WATCHING: ${playersArray.find(p=>p.id===spectatingTargetId).name}`;
}

function updateAliveDisplayHUD() { document.getElementById('alive-counter').innerText = `ALIVE: ${totalAlivePlayers}/20`; }

function exitToMenu() {
    clearInterval(timerInterval); clearInterval(gameLoopInterval); clearInterval(matchmakingTimer);
    document.getElementById('spectator-controls').classList.add('hidden');
    showScreen('main-menu');
}
