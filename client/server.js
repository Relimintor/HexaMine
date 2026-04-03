const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Optional: serve a simple static page (for testing)
// app.use(express.static("public"));

let players = [];

wss.on("connection", (ws) => {
  console.log("Player connected");
  players.push(ws);

  ws.on("message", (msg) => {
    // Broadcast incoming message to all other players
    players.forEach((p) => {
      if (p !== ws && p.readyState === WebSocket.OPEN) {
        p.send(msg.toString());
      }
    });
  });

  ws.on("close", () => {
    players = players.filter((p) => p !== ws);
    console.log("Player disconnected");
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
