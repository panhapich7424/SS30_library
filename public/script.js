const socket = io();
let board = [], currentPlayer="red", playerColor=null, selected=null, roomId=null;

const boardEl=document.getElementById("board");
const turnEl=document.getElementById("turn");
const roomListEl=document.getElementById("roomList");
const menuScreen=document.getElementById("menuScreen");
const gameScreen=document.getElementById("gameScreen");
const endScreen=document.getElementById("endScreen");
const endMessage=document.getElementById("endMessage");
const chatMessages=document.getElementById("chatMessages");
const chatInput=document.getElementById("chatInput");
const chatSend=document.getElementById("chatSend");
const playAgainBtn=document.getElementById("playAgainBtn");
const exitBtn=document.getElementById("exitBtn");

// Menu
document.getElementById("createRoomBtn").onclick = ()=>{
  const id = "room"+Math.floor(Math.random()*10000);
  roomId=id;
  socket.emit("joinRoom",roomId);
};

// Socket events
socket.on("roomList", rooms=>{
  roomListEl.innerHTML="";
  rooms.forEach(room=>{
    const li=document.createElement("li");
    li.textContent=`${room.id} (${room.players}/2)`;
    li.style.cursor="pointer";
    if(room.players<2) li.onclick=()=>{
      roomId=room.id;
      socket.emit("joinRoom",room.id);
    };
    roomListEl.appendChild(li);
  });
});

socket.on("roomFull", ()=>alert("Room full!"));
socket.on("joinedRoom",(id,color)=>{ roomId=id; playerColor=color; alert(`Joined room ${id} as ${color}`); });
socket.on("startGame",(b,turn)=>{ 
  board=b; 
  currentPlayer=turn; 
  menuScreen.classList.add("hidden"); 
  gameScreen.classList.remove("hidden"); 
  endScreen.classList.add("hidden");
  playAgainBtn.disabled=false;
  drawBoard(); 
});
socket.on("updateBoard",(b,turn)=>{ board=b; currentPlayer=turn; drawBoard(); });
socket.on("gameOver", winner=>{
  endMessage.textContent = `${winner} Wins!`;
  endScreen.classList.remove("hidden");
});
socket.on("playerLeft", ()=>{ alert("Opponent left"); endScreen.classList.remove("hidden"); });
socket.on("exitToMenu", ()=>{
  gameScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  selected=null;
  roomId=null;
  playerColor=null;
});

// Chat
chatSend.onclick=sendMessage;
chatInput.addEventListener("keypress",e=>{ if(e.key==="Enter") sendMessage(); });
function sendMessage(){
  if(chatInput.value.trim()==="") return;
  socket.emit("sendMessage",{roomId,message:chatInput.value,playerColor});
  chatInput.value="";
}
socket.on("receiveMessage",({message,playerColor})=>{
  const div=document.createElement("div");
  div.textContent=`${playerColor}: ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop=chatMessages.scrollHeight;
});

// Board
function drawBoard(){
  boardEl.innerHTML="";
  board.forEach((row,r)=>{
    row.forEach((cell,c)=>{
      const div=document.createElement("div");
      div.classList.add("cell");
      if(cell!=="H"){
        const p=document.createElement("div");
        if(cell==="O"||cell==="P") p.classList.add("bluePiece");
        if(cell==="X"||cell==="R") p.classList.add("redPiece");
        if(cell==="P"||cell==="R") p.classList.add("king");
        div.appendChild(p);
      }
      div.onclick=()=>selectCell(r,c);
      boardEl.appendChild(div);
    });
  });
  turnEl.textContent=currentPlayer.charAt(0).toUpperCase()+currentPlayer.slice(1);
  turnEl.style.color=currentPlayer==="red"?"#e63946":"#0077b6";
}

// Move
function selectCell(r,c){
  const piecePlayer=getPlayer(board[r][c]);
  if(board[r][c]==="H" && selected){
    socket.emit("makeMove",{roomId,from:selected,to:{r,c}});
    selected=null;
  } else if(piecePlayer===playerColor){
    selected={r,c};
  } else selected=null;
}

function getPlayer(piece){
  if(piece==="O"||piece==="P") return "blue";
  if(piece==="X"||piece==="R") return "red";
  return null;
}

// Play Again & Exit
playAgainBtn.onclick = ()=>{
  socket.emit("requestRematch", roomId);
  playAgainBtn.disabled = true;
  endMessage.textContent = "Waiting for other player...";
};

exitBtn.onclick = ()=>{
  socket.emit("exitToMenu", roomId);
};
