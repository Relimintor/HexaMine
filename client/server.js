const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

let players = [];

server.on("connection", (ws) => {
    console.log("Player connected");

    players.push(ws);

    ws.on("message", (msg) => {
        // broadcast to all players
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

console.log("Server running on port", PORT);
