// Main State Management Engine
let currentGameMode = ''; 
let aiDifficulty = 'beginner'; 
let localPlayerName = 'RIYANSHU';
let activeRoomCode = '';
let activeRoomName = '';

// P2P Networking Infrastructure Variables (PeerJS System)
let peerInstance = null;
let activeConnection = null;
let isHostInstance = false;
let connectedPeerName = '';

// Board & Tick Simulation Settings
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

// Smooth Camera Follow States
let targetCamAngleX = 55;
let targetCamAngleZ = 0;
let currentCamAngleX = 55;
let currentCamAngleZ = 0;

const COLORS_POOL = ['#f44336', '#3f51b5', '#4caf50', '#ffeb3b', '#9c27b0', '#ff9800'];
const COLOR_NAMES = { '#f44336': 'RED', '#3f51b5': 'BLUE', '#4caf50': 'GREEN', '#ffeb3b': 'YELLOW', '#9c27b0': 'PURPLE', '#ff9800': 'ORANGE' };

// Handle Fullscreen Landscape trigger only AFTER picking a mode
function triggerModeSelection(targetScreenId, modeContext = '') {
    // Fire Immersive Fullscreen and Request Orientation Shift
    let docEl = document.documentElement;
    if (docEl.requestFullscreen) { docEl.requestFullscreen(); }
    else if (docEl.webkitRequestFullscreen) { docEl.webkitRequestFullscreen(); }
    
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => console.log("Orientation lock handled contextually"));
    }

    // Advance to target screen configuration
    showScreen(targetScreenId, modeContext);
}

function showScreen(screenId, modeContext = '') {
    document.querySelectorAll('.screen-overlay, #game-screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    if (modeContext) {
        currentGameMode = modeContext;
        document.getElementById('friend-options').classList.toggle('hidden', modeContext !== 'friend');
        document.getElementById('start-matchmaking-btn').classList.toggle('hidden', modeContext !== 'pvp');
        
        let title = document.getElementById('name-screen-title');
        if(modeContext === 'pvp') title.innerText = "ONLINE PVP SECTOR";
        if(modeContext === 'friend') title.innerText = "FRIEND CODES BOOT";
    }
}

// ==========================================
// PEER-TO-PEER (P2P) SERVERLESS FRIEND MODE
// ==========================================
function initPeerJSEngine(callback) {
    if (peerInstance) return callback();
    
    let customPeerId = 'CC2D-' + Math.floor(1000 + Math.random() * 9000);
    activeRoomCode = customPeerId.split('-')[1];

    peerInstance = new Peer(customPeerId);
    
    peerInstance.on('open', (id) => {
        console.log('Peer engine custom footprint at: ' + id);
        callback();
    });

    peerInstance.on('connection', (conn) => {
        activeConnection = conn;
        isHostInstance = true;
        setupP2PDataChannels();
    });
    
    peerInstance.on('error', (err) => {
        alert("Arcade Broker Link Error: " + err.type);
        exitToMenu();
    });
}

function hostFriendRoom() {
    const name = document.getElementById('username-input').value.trim();
    const rName = document.getElementById('room-name-input').value.trim();
    if(!name || !rName) return alert("Fill Name and Room codex fields!");
    
    localPlayerName = name.toUpperCase();
    activeRoomName = rName.toUpperCase();

    showScreen('lobby-screen');
    document.getElementById('lobby-status').innerText = "LINKING CHANNELS...";
    
    initPeerJSEngine(() => {
        const infoBox = document.getElementById('room-info-display');
        infoBox.classList.remove('hidden');
        infoBox.innerHTML = `ROOM: ${activeRoomName}<br>INSERT CODE: <span style="color:#00ffcc; font-size:1.2rem;">${activeRoomCode}</span>`;
        document.getElementById('lobby-status').innerText = "AWAITING SECOND INSERTION COIN...";
        document.getElementById('player-list-lobby').innerHTML = `<div style="color:#00ffcc">• ${localPlayerName} (BOX_1)</div>`;
    });
}

function connectToFriendRoom() {
    const name = document.getElementById('username-input').value.trim();
    const code = document.getElementById('join-code-input').value.trim();
    if(!name || code.length !== 4) return alert("Requires 4-Digit Active Key!");
    
    localPlayerName = name.toUpperCase();
    activeRoomCode = code;
    isHostInstance = false;

    showScreen('lobby-screen');
    document.getElementById('lobby-status').innerText = "INTERCEPTING SIGNAL WIRE...";

    initPeerJSEngine(() => {
        let targetHostId = 'CC2D-' + activeRoomCode;
        activeConnection = peerInstance.connect(targetHostId);
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
            document.getElementById('lobby-status').innerText = "CABINET LINK SECURED! SYSTEMS READY.";
            
            if (isHostInstance) {
                document.getElementById('player-list-lobby').innerHTML = `
                    <div style="color:#00ffcc">• ${localPlayerName} (BOX_1)</div>
                    <div style="color:#ffea00">• ${connectedPeerName} (BOX_2)</div>`;
                document.getElementById('start-p2p-game-btn').classList.remove('hidden');
            } else {
                document.getElementById('player-list-lobby').innerHTML = `
                    <div style="color:#ffea00">• ${connectedPeerName} (BOX_1)</div>
                    <div style="color:#00ffcc">• ${localPlayerName} (BOX_2)</div>`;
                document.getElementById('lobby-status').innerText = "AWAITING ENGINE COMMAND FROM COIN CABINET HOST...";
            }
        }
        
        if (data.type === 'launch_game') {
            aiDifficulty = 'intermediate';
            initGameEngine();
        }
        
        if (data.type === 'sync_coordinates') {
            let remotePeer = playersArray.find(p => p.id === peerPlayerId);
            if (remotePeer) {
                remotePeer.x = data.x;
                remotePeer.y = data.y;
                remotePeer.z = data.z;
                remotePeer.alive = data.alive;
                remotePeer.angle = data.angle;
            }
        }

        if (data.type === 'sync_level') {
            currentRoundColor = data.targetColor;
            applyForcedServerTileLayout(data.layoutData);
            executeNetworkRoundTimerStart();
        }
        
        if (data.type === 'sync_elimination') {
            let targetPlayer = playersArray.find(p => p.id === data.targetId);
            if (targetPlayer && targetPlayer.alive) {
                eliminatePlayerProfileNode(targetPlayer);
            }
        }
    });

    activeConnection.on('close', () => {
        alert("P2P Coaxial connection cut down.");
        exitToMenu();
    });
}

function broadcastGameLaunchSignal() {
    if(activeConnection) {
        activeConnection.send({ type: 'launch_game' });
        initGameEngine();
    }
}

// ==========================================
// ONLINE PVP SIMULATION TIMEOUT TERMINAL
// ==========================================
function startMatchmakingLoop() {
    const name = document.getElementById('username-input').value.trim();
    if(!name) return alert("Nickname payload empty!");
    localPlayerName = name.toUpperCase();

    showScreen('lobby-screen');
    document.getElementById('room-info-display').classList.add('hidden');
    document.getElementById('lobby-status').innerText = "INTERCEPTING REGIONAL CHANNELS...";
    
    let bar = document.getElementById('lobby-progress-bar');
    let duration = 0;
    bar.style.width = '0%';

    if (matchmakingTimer) clearInterval(matchmakingTimer);
    matchmakingTimer = setInterval(() => {
        duration += 0.1;
        bar.style.width = `${(duration / 20) * 100}%`;
        if (duration >= 20) {
            clearInterval(matchmakingTimer);
            showScreen('server-error-screen');
        }
    }, 100);
}

function retryMatchmaking() { startMatchmakingLoop(); }
function startAIMode(diff) { aiDifficulty = diff; localPlayerName = "RIYANSHU (YOU)"; initGameEngine(); }

// ==========================================
// CORE ARCADE ENGINE & MAP INJECTOR
// ==========================================
function initGameEngine() {
    showScreen('game-screen');
    const map = document.getElementById('game-map');
    map.innerHTML = '';
    tilesData = [];
    playersArray = [];
    totalAlivePlayers = 20;
    spectatingTargetId = localPlayerId;
    
    currentCamAngleX = 55; currentCamAngleZ = 0;
    targetCamAngleX = 55; targetCamAngleZ = 0;

    document.getElementById('spectator-controls').classList.add('hidden');

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.left = `${col * TILE_DIM}px`;
            tile.style.top = `${row * TILE_DIM}px`;
            tile.dataset.id = `t_${row}_${col}`;
            map.appendChild(tile);
            tilesData.push({ id: tile.dataset.id, element: tile, color: '#251b3d', capturedBy: null });
        }
    }

    // Spawn 3D Box Entity Elements
    playersArray.push({
        id: localPlayerId, name: localPlayerName, x: 385, y: 600, z: 0, angle: 0, isBot: false, alive: true, element: createEntityNode(localPlayerName, 'local-player')
    });

    let totalAIBots = 19;
    if (currentGameMode === 'friend' && activeConnection) {
        playersArray.push({
            id: peerPlayerId, name: connectedPeerName, x: 420, y: 600, z: 0, angle: 0, isBot: false, alive: true, element: createEntityNode(connectedPeerName, 'peer-player')
        });
        totalAIBots = 18;
    }

    for(let i = 1; i <= totalAIBots; i++) {
        let nameTag = `BOX_${i}`;
        playersArray.push({
            id: `b_${i}`, name: nameTag, x: Math.random() * 700 + 50, y: Math.random() * 550 + 50, z: 0, angle: 0, isBot: true, alive: true, element: createEntityNode(nameTag, 'bot')
        });
    }

    updateAliveDisplayHUD();
    setupTouchJoystickControl();

    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(runEnginePhysicsTick, 1000 / 60);

    if (currentGameMode !== 'friend' || isHostInstance) {
        startNextRoundLoop();
    }
}

function createEntityNode(name, variantClass) {
    const map = document.getElementById('game-map');
    const node = document.createElement('div');
    node.className = `entity ${variantClass}`;
    const label = document.createElement('div');
    label.className = 'entity-name';
    label.innerText = name;
    node.appendChild(label);
    map.appendChild(node);
    return node;
}

// ==========================================
// UNBREAKABLE GLOBAL STUCK-FREE JOYSTICK
// ==========================================
let joystickVectors = { x: 0, y: 0 };

function setupTouchJoystickControl() {
    const knob = document.getElementById('joystick-knob');
    const zone = document.getElementById('joystick-zone');
    
    joystickVectors = { x: 0, y: 0 };
    let activePointerId = null;

    // Reset calculation tracker helper
    function forceResetJoystickState() {
        activePointerId = null;
        knob.style.left = '50%'; 
        knob.style.top = '50%'; 
        joystickVectors = { x: 0, y: 0 };
    }

    zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activePointerId = e.pointerId;
        zone.setPointerCapture(e.pointerId);
        processCoordinates(e);
    });

    zone.addEventListener('pointermove', (e) => {
        if (activePointerId === e.pointerId) {
            processCoordinates(e);
        }
    });

    // Handle standard pointer up/cancel inside the region
    zone.addEventListener('pointerup', (e) => { if(e.pointerId === activePointerId) forceResetJoystickState(); });
    zone.addEventListener('pointercancel', (e) => { if(e.pointerId === activePointerId) forceResetJoystickState(); });

    // GLOBAL CATCHERS: Safely unlocks movement even if fingers leave the boundary area completely
    window.addEventListener('pointerup', forceResetJoystickState);
    window.addEventListener('pointercancel', forceResetJoystickState);

    function processCoordinates(e) {
        let bounds = zone.getBoundingClientRect();
        let centerX = bounds.left + bounds.width / 2;
        let centerY = bounds.top + bounds.height / 2;
        let deltaX = e.clientX - centerX;
        let deltaY = e.clientY - centerY;
        let totalDistance = Math.hypot(deltaX, deltaY);
        let absoluteRadius = bounds.width / 2;

        if (totalDistance > absoluteRadius) {
            deltaX = (deltaX / totalDistance) * absoluteRadius;
            deltaY = (deltaY / totalDistance) * absoluteRadius;
        }

        knob.style.left = `${50 + (deltaX / bounds.width) * 100}%`;
        knob.style.top = `${50 + (deltaY / bounds.height) * 100}%`;
        
        // Populate precise float vector layouts smoothly
        joystickVectors.x = deltaX / absoluteRadius;
        joystickVectors.y = deltaY / absoluteRadius;
    }
}

// Keyboard Fallback
let keyStateTracker = {};
window.onkeydown = (e) => { keyStateTracker[e.key.toLowerCase()] = true; };
window.onkeyup = (e) => { keyStateTracker[e.key.toLowerCase()] = false; };

function triggerLocalPlayerJump() {
    let hero = playersArray.find(p => p.id === localPlayerId);
    if (hero && hero.alive && hero.z === 0) hero.z = 16;
}

// ==========================================
// TICK SIMULATION & MAP PERSPECTIVE ENGINE
// ==========================================
function runEnginePhysicsTick() {
    const currentMaxVelocity = 4.6;
    let hero = playersArray.find(p => p.id === localPlayerId);
    let currentInputMoved = false;
    let currentMoveVector = { x: 0, y: 0 };

    if (hero && hero.alive) {
        // Calculate Touch Vectors
        if (Math.abs(joystickVectors.x) > 0.1 || Math.abs(joystickVectors.y) > 0.1) {
            currentMoveVector.x = joystickVectors.x * currentMaxVelocity;
            currentMoveVector.y = joystickVectors.y * currentMaxVelocity;
            currentInputMoved = true;
        }

        // Calculate Keypad entries
        if (keyStateTracker['w'] || keyStateTracker['arrowup']) { currentMoveVector.y = -currentMaxVelocity; currentInputMoved = true; }
        if (keyStateTracker['s'] || keyStateTracker['arrowdown']) { currentMoveVector.y = currentMaxVelocity; currentInputMoved = true; }
        if (keyStateTracker['a'] || keyStateTracker['arrowleft']) { currentMoveVector.x = -currentMaxVelocity; currentInputMoved = true; }
        if (keyStateTracker['d'] || keyStateTracker['arrowright']) { currentMoveVector.x = currentMaxVelocity; currentInputMoved = true; }
        if (keyStateTracker[' ']) triggerLocalPlayerJump();

        if (currentInputMoved) {
            hero.x += currentMoveVector.x;
            hero.y += currentMoveVector.y;
            hero.angle = Math.atan2(currentMoveVector.y, currentMoveVector.x) * (180 / Math.PI);
        }

        hero.x = Math.max(4, Math.min(762, hero.x));
        hero.y = Math.max(4, Math.min(762, hero.y));

        if (currentGameMode === 'friend' && activeConnection) {
            activeConnection.send({
                type: 'sync_coordinates', x: hero.x, y: hero.y, z: hero.z, angle: hero.angle, alive: hero.alive
            });
        }
    }

    // MAP DYNAMIC ROTATION MATHEMATICS (FOLLOW MECHANIC)
    let targetSubject = playersArray.find(p => p.id === spectatingTargetId);
    if (targetSubject && targetSubject.alive) {
        let normX = (targetSubject.x - 400) / 400; 
        let normY = (targetSubject.y - 400) / 400; 

        targetCamAngleX = 54 + (normY * 13); 
        targetCamAngleZ = -(normX * 24); 
    } else {
        targetCamAngleX = 55; targetCamAngleZ = 0;
    }

    // Smooth camera interpolation tracking
    currentCamAngleX += (targetCamAngleX - currentCamAngleX) * 0.08;
    currentCamAngleZ += (targetCamAngleZ - currentCamAngleZ) * 0.08;

    let mapNode = document.getElementById('game-map');
    if (mapNode) {
        mapNode.style.transform = `rotateX(${currentCamAngleX}deg) rotateZ(${currentCamAngleZ}deg)`;
    }

    // Process Active Board Elements
    playersArray.forEach(p => {
        if (!p.alive) return;

        if (p.z > 0 || p.z !== 0) {
            p.z -= 0.8; if (p.z < 0) p.z = 0;
        }

        if (p.isBot && isRoundActive && (currentGameMode !== 'friend' || isHostInstance)) {
            executeAdvancedBotAIPhysics(p);
        }

        // Project translations smoothly onto map grid layout
        p.element.style.left = `${p.x}px`;
        p.element.style.top = `${p.y}px`;
        p.element.style.transform = `translateZ(${14 + p.z}px) rotateY(${p.z * 4}deg)`;

        let col = Math.floor((p.x + 16) / TILE_DIM);
        let row = Math.floor((p.y + 16) / TILE_DIM);
        let currentTile = tilesData.find(t => t.id === `t_${row}_${col}`);

        if (currentTile && isRoundActive && currentTile.color === currentRoundColor && p.z === 0) {
            if (currentTile.capturedBy === null || currentTile.capturedBy === p.id) {
                tilesData.forEach(t => { if(t.capturedBy === p.id) { t.capturedBy = null; t.element.style.border = '4px solid #0e071e'; } });
                currentTile.capturedBy = p.id;
                currentTile.element.style.border = `4px dashed ${p.isBot ? '#ff0055' : '#00ffcc'}`;
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

    let tx = parseInt(targetTile.element.style.left) + 21;
    let ty = parseInt(targetTile.element.style.top) + 21;
    let speed = aiDifficulty === 'beginner' ? 2.2 : (aiDifficulty === 'master' ? 4.9 : 3.5);

    if (Math.abs(bot.x - tx) > 4) bot.x += bot.x < tx ? speed : -speed;
    if (Math.abs(bot.y - ty) > 4) bot.y += bot.y < ty ? speed : -speed;
}

// ==========================================
// ARCADIA RULES TIMERS & GAME MASTER SEQUENCE
// ==========================================
function startNextRoundLoop() {
    isRoundActive = false;
    currentRoundColor = '';
    document.getElementById('target-color-display').innerText = "ROLLING NEW BOARD TILES...";
    document.getElementById('target-color-display').style.color = '#ffffff';

    tilesData.forEach(t => {
        t.color = '#251b3d'; t.capturedBy = null; t.element.className = 'tile';
        t.element.style.backgroundColor = '#251b3d'; t.element.style.border = '4px solid #0e071e';
    });

    setTimeout(() => {
        let allowedLimit = totalAlivePlayers - 1;
        currentRoundColor = COLORS_POOL[Math.floor(Math.random() * COLORS_POOL.length)];
        document.getElementById('target-color-display').innerText = `DANGER: STEAL ${COLOR_NAMES[currentRoundColor]}!`;
        document.getElementById('target-color-display').style.color = currentRoundColor;

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
            t.color = assignedColor;
            t.element.style.backgroundColor = assignedColor;
            trackingLayoutArray.push({ id: t.id, color: assignedColor });
        });

        if (currentGameMode === 'friend' && activeConnection && isHostInstance) {
            activeConnection.send({
                type: 'sync_level', targetColor: currentRoundColor, layoutData: trackingLayoutArray
            });
        }

        executeNetworkRoundTimerStart();
    }, 3200);
}

function applyForcedServerTileLayout(layoutData) {
    layoutData.forEach(data => {
        let tile = tilesData.find(t => t.id === data.id);
        if (tile) {
            tile.color = data.color;
            tile.element.style.backgroundColor = data.color;
        }
    });
}

function executeNetworkRoundTimerStart() {
    isRoundActive = true;
    gameTimer = 20;
    document.getElementById('target-color-display').innerText = `DANGER: CLAIM ${COLOR_NAMES[currentRoundColor]}!`;
    document.getElementById('target-color-display').style.color = currentRoundColor;
    document.getElementById('timer-display').innerText = `${gameTimer}s`;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        gameTimer--;
        document.getElementById('timer-display').innerText = `${gameTimer}s`;
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
            alert(`ARCADE SESSION OVER! WINNER BOX: ${winName}`);
            exitToMenu();
        } else {
            startNextRoundLoop();
        }
    }, 1200);
}

function eliminatePlayerProfileNode(player) {
    player.alive = false;
    player.element.style.transition = 'transform 1.1s, opacity 1.1s';
    player.element.style.transform = 'scale(0) rotateX(180deg) translateZ(-600px)';
    player.element.style.opacity = '0';
    totalAlivePlayers--;

    const container = document.getElementById('notification-area');
    const noticeNode = document.createElement('div');
    noticeNode.className = 'notif';
    noticeNode.innerText = `${player.name} ELIMINATED!`;
    container.appendChild(noticeNode);

    if (player.id === localPlayerId) {
        document.getElementById('spectator-controls').classList.remove('hidden');
        spectateNextEntity();
    }
}

function spectateNextEntity() {
    let alive = playersArray.filter(p => p.alive); if(alive.length === 0) return;
    let idx = alive.findIndex(p => p.id === spectatingTargetId);
    spectatingTargetId = alive[(idx + 1) % alive.length].id;
    document.getElementById('spectator-msg').innerText = `FEED HACK: ${playersArray.find(p=>p.id===spectatingTargetId).name}`;
}

function updateAliveDisplayHUD() { document.getElementById('alive-counter').innerText = `BOXES: ${totalAlivePlayers}/20`; }

function exitToMenu() {
    clearInterval(timerInterval); clearInterval(gameLoopInterval); clearInterval(matchmakingTimer);
    document.getElementById('spectator-controls').classList.add('hidden');
    showScreen('main-menu');
}
