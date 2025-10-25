const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
app.use(express.static("public"));

let rooms = {}; // roomId -> {players:[], board:[][], currentPlayer, gameOver}

// --- Board setup ---
function createInitialBoard() {
  return [
    ['O','O','O','O','O','O','O','H'],
    ['H','H','H','H','H','H','H','P'],
    ['O','O','O','O','O','O','O','O'],
    ['H','H','H','H','H','H','H','H'],
    ['H','H','H','H','H','H','H','H'],
    ['X','X','X','X','X','X','X','X'],
    ['R','H','H','H','H','H','H','H'],
    ['H','X','X','X','X','X','X','X']
  ];
}

// --- Utils ---
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function getPlayer(piece) {
  if (piece === "O" || piece === "P") return "blue";
  if (piece === "X" || piece === "R") return "red";
  return null;
}

// --- Broadcast room list ---
function broadcastRooms() {
  const roomList = Object.keys(rooms).map(id => ({
    id,
    players: rooms[id].players.length
  }));
  io.emit("roomList", roomList);
}

// --- Socket.IO events ---
io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // Chat
  socket.on("sendMessage", ({roomId, message, playerColor})=>{
    io.to(roomId).emit("receiveMessage", {message, playerColor});
  });

  // Join room
  socket.on("joinRoom", roomId => {
    if (!rooms[roomId]) rooms[roomId] = {players:[], board:createInitialBoard(), currentPlayer:"red", gameOver:false};
    const room = rooms[roomId];
    if (room.players.length >= 2) { socket.emit("roomFull"); return; }

    room.players.push(socket.id);
    socket.join(roomId);
    const playerColor = room.players.length === 1 ? "red" : "blue";
    socket.emit("joinedRoom", roomId, playerColor);
    broadcastRooms();

    if(room.players.length===2){
      io.to(roomId).emit("startGame", room.board, room.currentPlayer);
    }
  });

  // Move
  socket.on("makeMove", ({roomId, from, to})=>{
    const room = rooms[roomId];
    if(!room || room.gameOver) return;
    const piece = room.board[from.r][from.c];
    if(!piece) return;
    if(getPlayer(piece)!==room.currentPlayer) return;

    room.board[to.r][to.c] = piece;
    room.board[from.r][from.c] = "H";

    rekCapture(room.board, to.r, to.c);
    trappingCapture(room.board);

    const winner = checkWin(room.board);
    if(winner){
      room.gameOver=true;
      io.to(roomId).emit("gameOver", winner);
      return;
    }

    room.currentPlayer = room.currentPlayer==="red"?"blue":"red";
    io.to(roomId).emit("updateBoard", room.board, room.currentPlayer);
  });

  // Disconnect
  socket.on("disconnect", ()=>{
    console.log("User disconnected:", socket.id);
    for(const roomId in rooms){
      const room = rooms[roomId];
      const idx = room.players.indexOf(socket.id);
      if(idx!==-1){
        room.players.splice(idx,1);
        io.to(roomId).emit("playerLeft");
        if(room.players.length===0) delete rooms[roomId];
        broadcastRooms();
        break;
      }
    }
  });
});

// --- Capture logic ---
function rekCapture(board,r,c){
  const piece = board[r][c];
  if(!piece||piece==="H") return;
  const player = getPlayer(piece);
  const enemy = player==="red"?"blue":"red";

  [[0,1],[1,0],[0,-1],[-1,0]].forEach(([dx,dy])=>{
    const a=r+dx,b=c+dy,a2=r-dx,b2=c-dy;
    if(inBounds(a,b)&&inBounds(a2,b2)){
      const one=board[a][b], two=board[a2][b2];
      if(one && two && getPlayer(one)===enemy && getPlayer(two)===enemy){
        board[a][b]="H"; board[a2][b2]="H";
      }
    }
  });
}

function trappingCapture(board){
  const visited=Array.from({length:8},()=>Array(8).fill(false));
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      if(visited[r][c]||board[r][c]==="H") continue;
      const player=getPlayer(board[r][c]);
      const group=[],queue=[[r,c]];
      let hasEscape=false;
      visited[r][c]=true;

      while(queue.length){
        const [x,y]=queue.shift();
        group.push([x,y]);
        [[0,1],[1,0],[0,-1],[-1,0]].forEach(([dx,dy])=>{
          const nx=x+dx,ny=y+dy;
          if(!inBounds(nx,ny)) return;
          const target=board[nx][ny];
          if(target==="H") hasEscape=true;
          else if(getPlayer(target)===player&&!visited[nx][ny]){
            visited[nx][ny]=true;
            queue.push([nx,ny]);
          }
        });
      }

      if(!hasEscape) group.forEach(([x,y])=>board[x][y]="H");
    }
  }
}

function checkWin(board){
  let redKing=false, blueKing=false;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p=board[r][c];
      if(p==="P") blueKing=true;
      if(p==="R") redKing=true;
    }
  }
  if(!redKing) return "Blue";
  if(!blueKing) return "Red";
  return null;
}

server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
