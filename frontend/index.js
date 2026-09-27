const STORAGE_KEY = 'unoArenaSession';

const gameScreen = document.getElementById('game-screen');
const preGameScreen = document.getElementById('pregame-screen');
const createRoom = document.getElementById('createRoom');
const joinRoom = document.getElementById('joinRoom');
const pregameUtilites = document.getElementById('pregameUtilities');
const leaveButton = document.createElement('button');
leaveButton.id = 'leaveRoom';
leaveButton.textContent = 'Leave Room';
leaveButton.className = 'action-button dark';
const socket = io();
window.socket = socket;
const startButton = document.createElement('button');
startButton.id = 'startGame';
startButton.textContent = 'Start Game';
startButton.className = 'action-button cool';

function generateSessionId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredSession() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
        return {};
    }
}

function writeStoredSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
}

function ensureStoredSession() {
    const existing = readStoredSession();
    if (existing.sessionId) {
        return existing;
    }

    return writeStoredSession({
        sessionId: generateSessionId(),
        playerName: '',
        roomCode: '',
        phase: 'idle'
    });
}

function updateStoredSession(patch) {
    return writeStoredSession({
        ...ensureStoredSession(),
        ...patch
    });
}

function clearStoredPresence() {
    const sessionId = ensureStoredSession().sessionId;
    playerName = '';
    currentRoomCode = '';

    return writeStoredSession({
        sessionId,
        playerName: '',
        roomCode: '',
        phase: 'idle'
    });
}

function getSessionId() {
    return ensureStoredSession().sessionId;
}

function renderLobby(roomCode, players, hostSessionId) {
    pregameUtilites.innerHTML = '';

    const playerListDiv = document.createElement('div');
    playerListDiv.id = 'player-list';

    const title = document.createElement('h3');
    title.textContent = `Room Code: ${roomCode}`;
    playerListDiv.appendChild(title);

    players.forEach(name => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = name;
        playerListDiv.appendChild(playerDiv);
    });

    pregameUtilites.appendChild(playerListDiv);
    pregameUtilites.appendChild(leaveButton);

    if (hostSessionId === getSessionId()) {
        pregameUtilites.appendChild(startButton);
    }
}

function attemptSessionResume() {
    const session = ensureStoredSession();
    if (!session.roomCode || !session.playerName) {
        return;
    }

    playerName = session.playerName;
    currentRoomCode = session.roomCode;
    socket.emit('resumeSession', {
        roomCode: session.roomCode,
        sessionId: session.sessionId
    });
}

const storedSession = ensureStoredSession();
let playerName = storedSession.playerName || '';
let currentRoomCode = storedSession.roomCode || '';

socket.on('connect', attemptSessionResume);
socket.on('connected', msg => {
    console.log(msg);
});

createRoom.addEventListener('click', () => {
    const enteredName = prompt('Enter your name');
    if (!enteredName) {
        return;
    }

    playerName = enteredName.trim();
    if (!playerName) {
        return;
    }

    updateStoredSession({
        playerName
    });

    socket.emit('createRoom', {
        host: playerName,
        sessionId: getSessionId()
    });
});

leaveButton.addEventListener('click', () => {
    socket.emit('leaveRoom');
});

socket.on('createRoom', data => {
    currentRoomCode = data.roomCode;
    updateStoredSession({
        playerName,
        roomCode: data.roomCode,
        phase: 'lobby'
    });
    renderLobby(data.roomCode, data.roomPlayers, data.hostSessionId);
});

joinRoom.addEventListener('click', () => {
    const enteredRoomCode = prompt('Enter the Room code');
    const enteredName = prompt('Enter your name');

    if (!enteredRoomCode || !enteredName) {
        return;
    }

    const roomCode = enteredRoomCode.trim();
    playerName = enteredName.trim();

    if (!roomCode || !playerName) {
        return;
    }

    updateStoredSession({
        playerName
    });

    socket.emit('joinRoom', {
        player: playerName,
        code: roomCode,
        sessionId: getSessionId()
    });
});

startButton.addEventListener('click', () => {
    socket.emit('startGame');
});

socket.on('player_list_update', data => {
    currentRoomCode = data.roomCode;
    updateStoredSession({
        playerName,
        roomCode: data.roomCode,
        phase: 'lobby'
    });
    renderLobby(data.roomCode, data.players, data.hostSessionId);
});

socket.on('room_error', data => {
    if (data?.message) {
        window.alert(data.message);
    }
});

socket.on('session_expired', () => {
    clearStoredPresence();
    window.location.href = '/';
});

socket.on('disconnect', reason => {
    console.log(`Player disconnected: ${reason}`);
});

socket.on('redirect_to_index', data => {
    console.log('redirecting to index page');

    if (data?.clearSession) {
        clearStoredPresence();
    } else {
        updateStoredSession({
            phase: 'lobby'
        });
    }

    window.location.href = '/';
});
