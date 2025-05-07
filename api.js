// =====================
// 1. INISIALISASI FIREBASE
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyAaYFKvIjfMfYbv5rZ6X5MZrLDtgj5QOEc",
  authDomain: "ulartangga-online.firebaseapp.com",
  databaseURL: "https://ulartangga-online-default-rtdb.firebaseio.com", // Tambahkan ini
  projectId: "ulartangga-online",
  storageBucket: "ulartangga-online.firebasestorage.app",
  messagingSenderId: "344900787531",
  appId: "1:344900787531:web:d24f270489c1fdff8d1cce"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// =====================
// 2. FUNGSI UTAMA GAME
// =====================
let roomCode;
let playerId;

// Generate random ID
function generateId() {
  return 'player-' + Math.random().toString(36).substr(2, 9);
}

// Generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get random color for player
function getRandomColor() {
  const colors = ['#FF6584', '#6C63FF', '#48BB78', '#F6AD55', '#9F7AEA', '#4299E1', '#ED8936', '#667EEA'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Fungsi buat room baru
function createRoom(playerName) {
  playerId = generateId();
  roomCode = generateRoomCode();
  
  const roomRef = database.ref('rooms/' + roomCode);
  
  roomRef.set({
    host: playerId,
    players: {
      [playerId]: {
        name: playerName,
        position: 1,
        color: getRandomColor(),
        ready: false
      }
    },
    status: "waiting",
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
  
  // Listen perubahan data di room ini
  roomRef.on('value', (snapshot) => {
    const roomData = snapshot.val();
    if (roomData) {
      updateGameUI(roomData);
    }
  });
  
  return roomCode;
}

// Fungsi gabung room
function joinRoom(playerName, code) {
  playerId = generateId();
  roomCode = code.toUpperCase();
  
  const roomRef = database.ref('rooms/' + roomCode);
  
  return roomRef.once('value').then((snapshot) => {
    if (!snapshot.exists()) {
      throw new Error('Room tidak ditemukan');
    }
    
    return roomRef.child('players/' + playerId).set({
      name: playerName,
      position: 1,
      color: getRandomColor(),
      ready: false
    });
  }).then(() => {
    // Setup listeners
    setupRoomListeners();
    return roomCode;
  });
}

// Setup semua listener room
function setupRoomListeners() {
  const roomRef = database.ref('rooms/' + roomCode);
  
  // Listener untuk perubahan data room
  roomRef.on('value', (snapshot) => {
    const roomData = snapshot.val();
    if (roomData) {
      updateGameUI(roomData);
    }
  });
  
  // Listener untuk pemain baru bergabung
  roomRef.child('players').on('child_added', (snapshot) => {
    const player = snapshot.val();
    console.log(`${player.name} bergabung ke game!`);
    onPlayerJoined(player);
  });
  
  // Listener untuk perubahan posisi pemain
  roomRef.child('players').on('child_changed', (snapshot) => {
    const player = snapshot.val();
    onPlayerUpdated(player);
  });
  
  // Listener untuk status game
  roomRef.child('status').on('value', (snapshot) => {
    const status = snapshot.val();
    if (status === "playing") {
      onGameStarted();
    }
  });
}

// Update posisi pemain
function movePlayer(steps) {
  const playerRef = database.ref(`rooms/${roomCode}/players/${playerId}`);
  return playerRef.transaction((player) => {
    if (player) {
      player.position += steps;
      if (player.position > 100) player.position = 100;
    }
    return player;
  });
}

// Mulai game (hanya host)
function startGame() {
  if (!roomCode) return;
  
  const roomRef = database.ref('rooms/' + roomCode);
  return roomRef.update({
    status: "playing",
    startedAt: firebase.database.ServerValue.TIMESTAMP
  });
}

// Keluar dari room
function leaveRoom() {
  if (!roomCode || !playerId) return;
  
  const roomRef = database.ref('rooms/' + roomCode);
  return roomRef.child('players/' + playerId).remove().then(() => {
    // Hapus semua listener
    roomRef.off();
    
    // Reset variabel
    roomCode = null;
    playerId = null;
  });
}

// =====================
// 3. FUNGSI CALLBACK (IMPLEMENTASI DI FILE LAIN)
// =====================
// Fungsi-fungsi ini harus diimplementasikan di file utama game Anda
function updateGameUI(roomData) {
  // Implementasi: Update UI berdasarkan data room
  console.log('Room data updated:', roomData);
}

function onPlayerJoined(player) {
  // Implementasi: Tambahkan pemain ke UI
  console.log('Player joined:', player);
}

function onPlayerUpdated(player) {
  // Implementasi: Update posisi pemain di UI
  console.log('Player updated:', player);
}

function onGameStarted() {
  // Implementasi: Mulai permainan
  console.log('Game started!');
}
