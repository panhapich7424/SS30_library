const socket = io();

let board = [], currentPlayer = "red", playerColor = null, selected = null, roomId = null;

// DOM
const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn");
const roomListEl = document.getElementById("roomList");
const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const endMessage = document.getElementById("endMessage");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const createdRoomInfo = document.getElementById("createdRoomInfo");
const currentRoomEl = document.getElementById("currentRoom");
const youColorEl = document.getElementById("youColor");

// WIN POPUP elements
const winPopup = document.getElementById("winPopup");
const winnerText = document.getElementById("winnerText");
const playAgainBtn = document.getElementById("playAgainBtn");
const exitBtn = document.getElementById("exitBtn");
const waitingText = document.getElementById("waitingText");

// --- Menu ---
document.getElementById("createRoomBtn").onclick = () => {
  const id = "room" + Math.floor(Math.random() * 10000);
  roomId = id;
  socket.emit("joinRoom", roomId);
  createdRoomInfo.textContent = `Room created: ${id} — waiting for opponent...`;
};

document.getElementById("joinRoomBtn").onclick = () => {
  const id = document.getElementById("joinRoomInput").value.trim();
  if (!id) return alert("Enter a room ID");
  roomId = id;
  socket.emit("joinRoom", roomId);
};

document.getElementById("howBtn").onclick = () => { document.getElementById("howText").classList.remove("hidden") };
document.getElementById("closeHow").onclick = () => { document.getElementById("howText").classList.add("hidden") };
document.getElementById("menuReturnBtn").onclick = () => {
  endScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  chatMessages.innerHTML = "";
  createdRoomInfo.textContent = "";
  currentRoomEl.textContent = "—";
  youColorEl.textContent = "—";
  winPopup.classList.add("hidden");
};

// --- Socket events ---
socket.on("roomList", rooms => {
  roomListEl.innerHTML = "";
  rooms.forEach(room => {
    const li = document.createElement("li");
    li.textContent = `${room.id} (${room.players}/2)`;
    li.style.cursor = "pointer";
    if (room.players < 2) li.onclick = () => {
      roomId = room.id;
      socket.emit("joinRoom", room.id);
    };
    roomListEl.appendChild(li);
  });
});
socket.on("roomFull", () => alert("Room full!"));
socket.on("joinedRoom", (id, color) => {
  roomId = id;
  playerColor = color;
  createdRoomInfo.textContent = `You are in ${id} as ${color.toUpperCase()}`;
  youColorEl.textContent = color.charAt(0).toUpperCase() + color.slice(1);
  alert(`Joined room ${id} as ${color}`);
  currentRoomEl.textContent = id;
});
socket.on("startGame", (b, turn) => {
  board = b;
  currentPlayer = turn;
  menuScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  drawBoard();
});
socket.on("updateBoard", (b, turn) => {
  board = b;
  currentPlayer = turn;
  drawBoard();
});

// --- Game Over / Win Popup ---
function showWinPopup(winner) {
  winnerText.textContent = `${winner} Wins!`;
  winPopup.classList.remove("hidden");
  waitingText.classList.add("hidden");
  playAgainBtn.disabled = false;
  exitBtn.disabled = false;
}

playAgainBtn.addEventListener("click", () => {
  socket.emit("playerChoice", { roomId, choice: "playAgain" });
  playAgainBtn.disabled = true;
  exitBtn.disabled = true;
  waitingText.classList.remove("hidden");
  waitingText.textContent = "Waiting for the other player...";
});

exitBtn.addEventListener("click", () => {
  socket.emit("playerChoice", { roomId, choice: "exit" });
  playAgainBtn.disabled = true;
  exitBtn.disabled = true;
  waitingText.classList.remove("hidden");
  waitingText.textContent = "Exiting...";
});

socket.on("gameOver", winner => showWinPopup(winner));

socket.on("restartGame", (b, turn) => {
  winPopup.classList.add("hidden");
  board = b;
  currentPlayer = turn;
  drawBoard();
});

socket.on("endSession", ({ action }) => {
  if (action === "exit") {
    winPopup.classList.add("hidden");
    alert("Other player exited. Returning to main menu...");
    endScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    chatMessages.innerHTML = "";
    createdRoomInfo.textContent = "";
    currentRoomEl.textContent = "—";
    youColorEl.textContent = "—";
  }
});

socket.on("playerLeft", () => { alert("Opponent left"); endScreen.classList.remove("hidden") });

// --- Chat ---
chatSend.onclick = () => sendMessage();
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage() });
function sendMessage() {
  if (chatInput.value.trim() === "") return;
  socket.emit("sendMessage", { roomId, message: chatInput.value, playerColor });
  chatInput.value = "";
}
socket.on("receiveMessage", ({ message, playerColor }) => {
  const div = document.createElement("div");
  div.textContent = `${playerColor}: ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// --- Board display / orientation ---
function drawBoard() {
  boardEl.innerHTML = "";
  for (let dr = 0; dr < 8; dr++) {
    for (let dc = 0; dc < 8; dc++) {
      let r, c;
      if (playerColor === "blue") {
        r = 7 - dr;
        c = 7 - dc;
      } else {
        r = dr;
        c = dc;
      }

      const cell = board[r][c];
      const div = document.createElement("div");
      div.classList.add("cell");
      div.dataset.r = r;
      div.dataset.c = c;

      if (cell !== "H") {
        const p = document.createElement("div");
        if (cell === "O" || cell === "P") p.classList.add("bluePiece");
        if (cell === "X" || cell === "R") p.classList.add("redPiece");
        if (cell === "P" || cell === "R") p.classList.add("king");
        div.appendChild(p);
      }
      div.onclick = () => selectCell(parseInt(div.dataset.r), parseInt(div.dataset.c));
      boardEl.appendChild(div);
    }
  }
  turnEl.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
  turnEl.style.color = currentPlayer === "red" ? "#e63946" : "#0077b6";
  youColorEl.textContent = playerColor ? (playerColor.charAt(0).toUpperCase() + playerColor.slice(1)) : "—";
}

// --- Move ---
function selectCell(r, c) {
  const piecePlayer = getPlayer(board[r][c]);
  if (board[r][c] === "H" && selected) {
    socket.emit("makeMove", { roomId, from: selected, to: { r, c } });
    selected = null;
  } else if (piecePlayer === playerColor) {
    selected = { r, c };
  } else selected = null;
}

function getPlayer(piece) {
  if (piece === "O" || piece === "P") return "blue";
  if (piece === "X" || piece === "R") return "red";
  return null;
}
