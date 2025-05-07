// =====================
// 1. FIREBASE INITIALIZATION
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyAaYFKvIjfMfYbv5rZ6X5MZrLDtgj5QOEc",
  authDomain: "ulartangga-online.firebaseapp.com",
  databaseURL: "https://ulartangga-online-default-rtdb.firebaseio.com",
  projectId: "ulartangga-online",
  storageBucket: "ulartangga-online.firebasestorage.app",
  messagingSenderId: "344900787531",
  appId: "1:344900787531:web:d24f270489c1fdff8d1cce"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Player colors
const colors = [
  '#FF6584', // Pink
  '#6C63FF', // Purple
  '#48BB78', // Green
  '#F6AD55', // Orange
  '#9F7AEA', // Lavender
  '#4299E1', // Blue
  '#ED8936', // Dark Orange
  '#667EEA'  // Blue Purple
];

// =====================
// 2. CORE GAME FUNCTIONS
// =====================

/**
 * Generates a unique player ID
 * @return {string} Player ID
 */
function generatePlayerId() {
  return 'player-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generates a room code (6 characters)
 * @return {string} Room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Creates a new game room
 * @param {string} playerName Host player name
 * @param {number} maxPlayers Maximum number of players
 * @param {string} taskMode Game task mode ('system' or 'manual')
 * @return {Promise<{roomCode: string, playerId: string, roomRef: firebase.database.Reference}>}
 */
async function createRoom(playerName, maxPlayers, taskMode) {
  const playerId = generatePlayerId();
  const roomCode = generateRoomCode();
  const roomRef = database.ref('rooms/' + roomCode);
  
  await roomRef.set({
    host: playerId,
    players: {
      [playerId]: {
        name: playerName,
        position: 1,
        color: colors[0],
        ready: true,
        isCurrent: true
      }
    },
    currentPlayer: playerId,
    status: "waiting",
    maxPlayers,
    taskMode,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
  
  return { roomCode, playerId, roomRef };
}

/**
 * Joins an existing room
 * @param {string} playerName Player name
 * @param {string} roomCode Room code to join
 * @return {Promise<{roomCode: string, playerId: string, roomRef: firebase.database.Reference}>}
 */
async function joinRoom(playerName, roomCode) {
  const playerId = generatePlayerId();
  const formattedRoomCode = roomCode.toUpperCase();
  const roomRef = database.ref('rooms/' + formattedRoomCode);
  
  // Check if room exists
  const snapshot = await roomRef.once('value');
  if (!snapshot.exists()) {
    throw new Error('Room tidak ditemukan');
  }
  
  const roomData = snapshot.val();
  
  // Check if room is full
  const playerCount = Object.keys(roomData.players || {}).length;
  if (playerCount >= roomData.maxPlayers) {
    throw new Error('Room sudah penuh');
  }
  
  // Add player to room
  await roomRef.child('players/' + playerId).set({
    name: playerName,
    position: 1,
    color: colors[playerCount % colors.length],
    ready: false,
    isCurrent: false
  });
  
  return { roomCode: formattedRoomCode, playerId, roomRef };
}

/**
 * Sets up room listeners
 * @param {firebase.database.Reference} roomRef Firebase room reference
 * @param {function} onRoomUpdate Callback when room updates
 * @param {function} onPlayerJoined Callback when player joins
 * @param {function} onPlayerUpdated Callback when player updates
 * @param {function} onGameStarted Callback when game starts
 */
function setupRoomListeners(roomRef, onRoomUpdate, onPlayerJoined, onPlayerUpdated, onGameStarted) {
  // Room data listener
  roomRef.on('value', (snapshot) => {
    const roomData = snapshot.val();
    if (roomData && typeof onRoomUpdate === 'function') {
      onRoomUpdate(roomData);
    }
  });
  
  // Player joined listener
  roomRef.child('players').on('child_added', (snapshot) => {
    const player = snapshot.val();
    if (player && typeof onPlayerJoined === 'function') {
      onPlayerJoined(player);
    }
  });
  
  // Player updated listener
  roomRef.child('players').on('child_changed', (snapshot) => {
    const player = snapshot.val();
    if (player && typeof onPlayerUpdated === 'function') {
      onPlayerUpdated(player);
    }
  });
  
  // Game status listener
  roomRef.child('status').on('value', (snapshot) => {
    const status = snapshot.val();
    if (status === "playing" && typeof onGameStarted === 'function') {
      onGameStarted();
    }
  });
}

/**
 * Moves player position
 * @param {firebase.database.Reference} roomRef Room reference
 * @param {string} playerId Player ID
 * @param {number} steps Number of steps to move
 * @return {Promise} Move completion
 */
async function movePlayer(roomRef, playerId, steps) {
  const playerRef = roomRef.child('players/' + playerId);
  return playerRef.transaction((player) => {
    if (player) {
      player.position += steps;
      if (player.position > 100) player.position = 100;
    }
    return player;
  });
}

/**
 * Starts the game (host only)
 * @param {firebase.database.Reference} roomRef Room reference
 * @return {Promise} Start game completion
 */
async function startGame(roomRef) {
  // Set first player as current player
  const playersSnapshot = await roomRef.child('players').once('value');
  const players = playersSnapshot.val();
  const firstPlayerId = Object.keys(players)[0];
  
  return roomRef.update({
    status: "playing",
    currentPlayer: firstPlayerId,
    startedAt: firebase.database.ServerValue.TIMESTAMP
  });
}

/**
 * Leaves the room
 * @param {firebase.database.Reference} roomRef Room reference
 * @param {string} playerId Player ID
 * @return {Promise} Leave completion
 */
async function leaveRoom(roomRef, playerId) {
  // Remove player from room
  await roomRef.child('players/' + playerId).remove();
  
  // Check if room is empty
  const snapshot = await roomRef.child('players').once('value');
  if (!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
    // Delete empty room
    await roomRef.remove();
  }
  
  // Clean up listeners
  roomRef.off();
}

/**
 * Updates custom tasks in room
 * @param {firebase.database.Reference} roomRef Room reference
 * @param {object} customTasks Custom tasks object
 * @param {array} warningCells Warning cells array
 * @return {Promise} Update completion
 */
async function updateCustomTasks(roomRef, customTasks, warningCells) {
  return roomRef.update({
    customTasks,
    warningCells
  });
}

// =====================
// 3. EXPORT FUNCTIONS
// =====================
export const GameAPI = {
  colors,
  generatePlayerId,
  generateRoomCode,
  createRoom,
  joinRoom,
  setupRoomListeners,
  movePlayer,
  startGame,
  leaveRoom,
  updateCustomTasks
};
