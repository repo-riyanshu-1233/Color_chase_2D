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

const COLORS_POOL = ['#f44336', '#3f51b5', '#4caf50', '#ffeb3b', '#9c27b0', '#ff9800'];
const COLOR_NAMES = { '#f44336': 'RED', '#3f51b5': 'BLUE', '#4caf50': 'GREEN', '#ffeb3b': 'YELLOW', '#9c27b0': 'PURPLE', '#ff9800': 'ORANGE' };

// Fullscreen & Horizontal Enforcer Mechanism
function activateImmersiveFullscreen() {
    let docEl = document.documentElement;
    if (docEl.requestFullscreen) { docEl.requestFullscreen(); }
    else if (docEl.webkitRequestFullscreen) { docEl.webkitRequestFullscreen(); }
    else if (docEl.msRequestFullscreen) { docEl.msRequestFullscreen(); }
    
    // Attempt lock into landscape orientation layout
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => console.log("Orientation lock bypassed"));
    }
    
    document.getElementById('fullscreen-overlay').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
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
        if(modeContext === 'friend') title.innerText = "FRIEND DEPLOYMENT MATRIX";
    }
}

// ==========================================
// PEER-TO-PEER (P2P) SERVERLESS FRIEND MODE
// ==========================================
function initPeerJSEngine(callback) {
    if (peerInstance) return callback();
    
    // Generate a clean numeric 4-digit ID space for intuitive mobile entry
    let customPeerId = 'CC2D-' + Math.floor(1000 + Math.random() * 9000);
    activeRoomCode = customPeerId.split('-')[1];

    // Connect to the free public cloud broker signaling pool securely
    peerInstance = new Peer(customPeerId);
    
    peerInstance.on('open', (id) => {
        console.log('Peer engine secure footprint established at: ' + id);
        callback();
    });

    peerInstance.on('connection', (conn) => {
        activeConnection = conn;
        isHostInstance = true;
        setupP2PDataChannels();
    });
    
    peerInstance.on('error', (err) => {
        alert("Network broker conflict: " + err.type);
        exitToMenu();
    });
}

function hostFriendRoom() {
    const name = document.getElementById('username-input').value.trim();
    const rName = document.getElementById('room-name-input').value.trim();
    if(!name || !rName) return alert("Fill Name and Room Fields!");
    
    localPlayerName = name.toUpperCase();
    activeRoomName = rName.toUpperCase();

    showScreen('lobby-screen');
    document.getElementById('lobby-status').innerText = "CONFIGURING CLOUD RELAY CHANNEL...";
    
    initPeerJSEngine(() => {
        const infoBox = document.getElementById('room-info-display');
        infoBox.classList.remove('hidden');
        infoBox.innerHTML = `ROOM: ${activeRoomName}<br>SHARE THIS CODE: <span style="color:#00ffcc; font-size:1.5rem;">${activeRoomCode}</span>`;
        document.getElementById('lobby-status').innerText = "WAITING FOR FRIEND DEVICE NODE TO CONNECT...";
        document.getElementById('player-list-lobby').innerHTML = `<div style="color:#00ffcc">• ${localPlayerName} (YOU - HOST)</div>`;
    });
}

function connectToFriendRoom() {
    const name = document.getElementById('username-input').value.trim();
    const code = document.getElementById('join-code-input').value.trim();
    if(!name || code.length !== 4) return alert("Enter 4-Digit active code!");
    
    localPlayerName = name.toUpperCase();
    activeRoomCode = code;
    isHostInstance = false;

    showScreen('lobby-screen');
    document.getElementById('lobby-status').innerText = "LOCATING FRIEND TARGET HOOK...";

    initPeerJSEngine(() => {
        let targetHostId = 'CC2D-' + activeRoomCode;
        activeConnection = peerInstance.connect(targetHostId);
        setupP2PDataChannels();
    });
}

function setupP2PDataChannels() {
    activeConnection.on('open', () => {
        // Exchange player metadata profiles over the active connection
        activeConnection.send({ type: 'handshake', name: localPlayerName });
    });

    activeConnection.on('data', (data) => {
        if (data.type === 'handshake') {
            connectedPeerName = data.name.toUpperCase();
            document.getElementById('lobby-status').innerText = "STABLE CONNECTION DETECTED! READY TO INJECT LEVEL.";
            
            if (isHostInstance) {
                document.getElementById('player-list-lobby').innerHTML = `
                    <div style="color:#00ffcc">• ${localPlayerName} (YOU - HOST)</div>
                    <div style="color:#ffea00">• ${connectedPeerName} (FRIEND NODE)</div>`;
                document.getElementById('start-p2p-game-btn').classList.remove('hidden');
            } else {
                document.getElementById('player-list-lobby').innerHTML = `
                    <div style="color:#ffea00">• ${connectedPeerName} (HOST NODE)</div>
                    <div style="color:#00ffcc">• ${localPlayerName} (YOU)</div>`;
                document.getElementById('lobby-status').innerText = "AWAITING ENGINE DEPLOYMENT COMMAND FROM HOST...";
            }
        }
        
        if (data.type === 'launch_game') {
            aiDifficulty = 'intermediate'; // Default standardized cross-sync mode
            initGameEngine();
        }
        
        if (data.type === 'sync_coordinates') {
            let remotePeer = playersArray.find(p => p.id === peerPlayerId);
            if (remotePeer) {
                remotePeer.x = data.x;
                remotePeer.y = data.y;
                remotePeer.z = data.z;
                remotePeer.alive = data.alive;
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
        alert("P2P Node broken link connection lost.");
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
// ONLINE PVP SIMULATION FAILS (20-Sec Bar)
// ==========================================
function startMatchmakingLoop() {
    const name = document.getElementById('username-input').value.trim();
    if(!name) return alert("Please enter name payload data!");
    localPlayerName = name.toUpperCase();

    showScreen('lobby-screen');
    document.getElementById('room-info-display').classList.add('hidden');
    document.getElementById('lobby-status').innerText = "SEARCHING REGIONAL HIGH FREQUENCY POOLS...";
    
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
// CORE GAME ENGINE RUNTIME GRAPHICS
// ==========================================
function initGameEngine() {
    showScreen('game-screen');
    const map = document.getElementById('game-map');
    map.innerHTML = '';
    tilesData = [];
    playersArray = [];
    totalAlivePlayers = 20;
    spectatingTargetId = localPlayerId;
    document.getElementById('spectator-controls').classList.add('hidden');

    // Generate Standard Grid Layout Array Matrix
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.left = `${col * TILE_DIM}px`;
            tile.style.top = `${row * TILE_DIM}px`;
            tile.dataset.id = `t_${row}_${col}`;
            map.appendChild(tile);
            tilesData.push({ id: tile.dataset.id, element: tile, color: '#4c4654', capturedBy: null });
        }
    }

    // Spawn Local Controlled Human Node
    playersArray.push({
        id: localPlayerId, name: localPlayerName, x: 385, y: 600, z: 0, isBot: false, alive: true, element: createEntityNode(localPlayerName, 'local-player')
    });

    // Handle P2P Match Layout Population vs AI standard run configurations
    let totalAIBots = 19;
    if (currentGameMode === 'friend' && activeConnection) {
        playersArray.push({
            id: peerPlayerId, name: connectedPeerName, x: 420, y: 600, z: 0, isBot: false, alive: true, element: createEntityNode(connectedPeerName, 'peer-player')
        });
        totalAIBots = 18; // Readjust pool layout size
    }

    for(let i = 1; i <= totalAIBots; i++) {
        let nameTag = `BOT_${i}`;
        playersArray.push({
            id: `b_${i}`, name: nameTag, x: Math.random() * 700 + 50, y: Math.random() * 550 + 50, z: 0, isBot: true, alive: true, element: createEntityNode(nameTag, 'bot')
        });
    }

    updateAliveDisplayHUD();
    setupTouchJoystickControl();

    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(runEnginePhysicsTick, 1000 / 60);

    // Only host or solo engine loops determine core structural timing sync properties
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

// Touch Screen Interface Virtual Joystick Vector Math Engine Tracker
let joystickVectors = { x: 0, y: 0 };
function setupTouchJoystickControl() {
    const knob = document.getElementById('joystick-knob');
    const zone = document.getElementById('joystick-zone');
    
    zone.onpointerdown = (e) => { zone.setPointerCapture(e.pointerId); processMovementCoordinates(e); };
    zone.onpointermove = (e) => { if (zone.hasPointerCapture(e.pointerId)) processMovementCoordinates(e); };
    zone.onpointerup = (e) => { 
        zone.releasePointerCapture(e.pointerId); 
        knob.style.left = '50%'; knob.style.top = '50%'; 
        joystickVectors = { x: 0, y: 0 }; 
    };

    function processMovementCoordinates(e) {
        let bounds = zone.getBoundingClientRect();
        let centerX = bounds.left + bounds.width/2;
        let centerY = bounds.top + bounds.height/2;
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
        
        joystickVectors.x = deltaX / absoluteRadius;
        joystickVectors.y = deltaY / absoluteRadius;
    }
}

// Keyboard Capture Fallback Listeners
let keyStateTracker = {};
window.onkeydown = (e) => { keyStateTracker[e.key.toLowerCase()] = true; };
window.onkeyup = (e) => { keyStateTracker[e.key.toLowerCase()] = false; };

function triggerLocalPlayerJump() {
    let hero = playersArray.find(p => p.id === localPlayerId);
    if (hero && hero.alive && hero.z === 0) hero.z = 15;
}

function runEnginePhysicsTick() {
    const currentMaxVelocity = 4.5;
    let hero = playersArray.find(p => p.id === localPlayerId);

    if (hero && hero.alive) {
        // Map Virtual Joystick Forces
        if (Math.abs(joystickVectors.x) > 0.1) hero.x += joystickVectors.x * currentMaxVelocity;
        if (Math.abs(joystickVectors.y) > 0.1) hero.y += joystickVectors.y * currentMaxVelocity;

        // Map Keyboard Vectors Fallback
        if (keyStateTracker['w'] || keyStateTracker['arrowup']) hero.y -= currentMaxVelocity;
        if (keyStateTracker['s'] || keyStateTracker['arrowdown']) hero.y += currentMaxVelocity;
        if (keyStateTracker['a'] || keyStateTracker['arrowleft']) hero.x -= currentMaxVelocity;
        if (keyStateTracker['d'] || keyStateTracker['arrowright']) hero.x += currentMaxVelocity;
        if (keyStateTracker[' ']) triggerLocalPlayerJump();

        hero.x = Math.max(0, Math.min(774, hero.x));
        hero.y = Math.max(0, Math.min(774, hero.y));

        // Sync local positions data frame array directly over connection stream channel
        if (currentGameMode === 'friend' && activeConnection) {
            activeConnection.send({
                type: 'sync_coordinates', x: hero.x, y: hero.y, z: hero.z, alive: hero.alive
            });
        }

        let mapNode = document.getElementById('game-map');
        let adaptiveTiltValue = 50 + ((hero.y - 450) / 40);
        mapNode.style.transform = `rotateX(${adaptiveTiltValue}deg)`;
    }

    // Process Alternate Network Entities Physics Core Modules
    playersArray.forEach(p => {
        if (!p.alive) return;

        if (p.z > 0 || p.z !== 0) {
            p.z -= 0.8;
            if (p.z < 0) p.z = 0;
        }

        if (p.isBot && isRoundActive && (currentGameMode !== 'friend' || isHostInstance)) {
            executeAdvancedBotAIPhysics(p);
        }

        p.element.style.left = `${p.x}px`;
        p.element.style.top = `${p.y}px`;
        p.element.style.transform = `translateZ(${12 + p.z}px)`;

        // Claim Capture Processing Rules
        let col = Math.floor((p.x + 13) / TILE_DIM);
        let row = Math.floor((p.y + 13) / TILE_DIM);
        let currentTile = tilesData.find(t => t.id === `t_${row}_${col}`);

        if (currentTile && isRoundActive && currentTile.color === currentRoundColor && p.z === 0) {
            if (currentTile.capturedBy === null || currentTile.capturedBy === p.id) {
                tilesData.forEach(t => { if(t.capturedBy === p.id) { t.capturedBy = null; t.element.style.border = '2px solid #1e1726'; } });
                currentTile.capturedBy = p.id;
                currentTile.element.style.border = `3px dashed ${p.isBot ? '#ff0055' : '#00ffcc'}`;
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

    let tx = parseInt(targetTile.element.style.left) + 24;
    let ty = parseInt(targetTile.element.style.top) + 24;
    let speed = aiDifficulty === 'beginner' ? 2.0 : (aiDifficulty === 'master' ? 5.0 : 3.4);

    if (Math.abs(bot.x - tx) > 4) bot.x += bot.x < tx ? speed : -speed;
    if (Math.abs(bot.y - ty) > 4) bot.y += bot.y < ty ? speed : -speed;
}

// ==========================================
// CENTRAL SERVER AND GAME MASTER EVENTS
// ==========================================
function startNextRoundLoop() {
    isRoundActive = false;
    currentRoundColor = '';
    document.getElementById('target-color-display').innerText = "ALL TILES RESETTING CORE MATRIX...";
    document.getElementById('target-color-display').style.color = '#ffffff';

    tilesData.forEach(t => {
        t.color = '#4c4654'; t.capturedBy = null; t.element.className = 'tile';
        t.element.style.backgroundColor = '#4c4654'; t.element.style.border = '2px solid #1e1726';
    });

    setTimeout(() => {
        let allowedLimit = totalAlivePlayers - 1;
        currentRoundColor = COLORS_POOL[Math.floor(Math.random() * COLORS_POOL.length)];
        document.getElementById('target-color-display').innerText = `RUN TO TARGET: ${COLOR_NAMES[currentRoundColor]}!`;
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

        // Sync generation data arrays downstream over connection channels
        if (currentGameMode === 'friend' && activeConnection && isHostInstance) {
            activeConnection.send({
                type: 'sync_level', targetColor: currentRoundColor, layoutData: trackingLayoutArray
            });
        }

        executeNetworkRoundTimerStart();
    }, 3000);
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
    document.getElementById('target-color-display').innerText = `RUN TO TARGET: ${COLOR_NAMES[currentRoundColor]}!`;
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
            let col = Math.floor((p.x + 13) / TILE_DIM);
            let row = Math.floor((p.y + 13) / TILE_DIM);
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
            let winName = survivors.length === 1 ? survivors[0].name : "VOID";
            alert(`MATCH CONCLUDED! VICTORY ARCHTYPE: ${winName}`);
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
    const noticeNode = document.createElement('div');
    noticeNode.className = 'notif';
    noticeNode.innerText = `${player.name} DEPLOYMENT TERMINATED!`;
    container.appendChild(noticeNode);

    if (player.id === localPlayerId) {
        document.getElementById('spectator-controls').classList.remove('hidden');
    }
}

// Spectator Matrix Observe Loop Tracker Engine Hooks
function spectateNextEntity() {
    let alive = playersArray.filter(p => p.alive); if(alive.length === 0) return;
    let idx = alive.findIndex(p => p.id === spectatingTargetId);
    spectatingTargetId = alive[(idx + 1) % alive.length].id;
    document.getElementById('spectator-msg').innerText = `MONITORING ENTITY FEED: ${playersArray.find(p=>p.id===spectatingTargetId).name}`;
}

function updateAliveDisplayHUD() { document.getElementById('alive-counter').innerText = `Entities: ${totalAlivePlayers}/20`; }

function exitToMenu() {
    clearInterval(timerInterval); clearInterval(gameLoopInterval); clearInterval(matchmakingTimer);
    document.getElementById('spectator-controls').classList.add('hidden');
    showScreen('main-menu');
}
