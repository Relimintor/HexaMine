import { OFFICIAL_SERVER } from "../../client/server-list.js";

const OFFICIAL_WORLD_ID = "official-world-1";

let socket;

export function isMultiplayerConnected() {
  return socket && socket.readyState === WebSocket.OPEN;
}

export function connectOfficialWorld({ onStatus }) {
  if (isMultiplayerConnected()) {
    onStatus(`Connected to ${OFFICIAL_WORLD_ID} on HexaMine Official.`);
    return socket;
  }

  socket = new WebSocket(OFFICIAL_SERVER.socketUrl);

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "join_world",
        worldId: OFFICIAL_WORLD_ID,
      }),
    );
    onStatus(`Connected to multiplayer world: ${OFFICIAL_WORLD_ID}.`);
  });

  socket.addEventListener("message", (event) => {
    onStatus(`Multiplayer update: ${String(event.data).slice(0, 120)}`);
  });

  socket.addEventListener("close", () => {
    onStatus("Disconnected from multiplayer world.");
  });

  socket.addEventListener("error", () => {
    onStatus("Multiplayer connection error. Check render backend status.");
  });

  return socket;
}
