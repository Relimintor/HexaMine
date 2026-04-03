const express = require("express");
const WebSocket = require("ws");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve your game client
app.use(express.static("public"));

let players = [];

wss.on("connection", (ws) => {
  console.log("Player connected");
  players.push(ws);

  ws.on("message", (msg) => {
    // Broadcast to all other players
    players.forEach(p => {
      if (p !== ws && p.readyState === WebSocket.OPEN) {
        p.send(msg.toString());
      }
    });
  });

  ws.on("close", () => {
    players = players.filter(p => p !== ws);
    console.log("Player disconnected");
  });
});

server.listen(PORT, () => console.log("Server running on port", PORT));
