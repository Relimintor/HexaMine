import { getServerList } from "./client/server-list.js";
import { mountMainMenu, setStatus } from "./main/menu-screen.js";
import { connectOfficialWorld, isMultiplayerConnected } from "./main/multiplayer/session.js";
import { setupNewWorldScreen } from "./main/new-world-screen.js";
import { loadWasmRuntime } from "./main/wasm-runtime.js";
import { buildIcosphereTopology, mapSizeToSubdivision } from "./main/world/icosphere-topology.js";
import { getWorlds, saveWorld } from "./main/world/world-storage.js";

function formatServerSummary() {
  const names = getServerList().map((server) => server.name);
  return names.join(", ");
}

function renderWorldList() {
  const worldListNode = document.querySelector("#world-list");
  if (!worldListNode) return;

  const worlds = getWorlds();
  worldListNode.innerHTML = "";

  if (worlds.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No worlds yet. Create one from New World.";
    worldListNode.appendChild(emptyItem);
    return;
  }

  worlds
    .slice()
    .reverse()
    .forEach((world) => {
      const item = document.createElement("li");
      item.textContent = `${world.worldName} — ${world.mode}, ${world.size}, ${world.terrain}`;
      worldListNode.appendChild(item);
    });
}

function tryQuitTab() {
  window.close();

  setTimeout(() => {
    if (!document.hidden) {
      window.location.replace("about:blank");
    }
  }, 120);
}

function createMenuHandlers(newWorldScreen) {
  return function handleMenuAction(action, actionLabel) {
    if (action === "quit") {
      setStatus("Quit selected. Closing tab, or falling back to a blank page.");
      tryQuitTab();
      return;
    }

    if (action === "new-world") {
      setStatus("New World selected. Opening world creation screen.");
      newWorldScreen.open();
      return;
    }

    if (action === "multiplayer") {
      connectOfficialWorld({
        onStatus: setStatus,
      });
      return;
    }

    if (action === "load-world") {
      renderWorldList();
      setStatus("Saved worlds refreshed in the Saved Worlds panel.");
      return;
    }

    setStatus(`${actionLabel} selected. System wiring in progress.`);
  };
}

function createWorldFromConfig(config) {
  const subdivisionLevel = mapSizeToSubdivision(config.size);
  const topology = buildIcosphereTopology(subdivisionLevel);

  return {
    ...config,
    topology,
  };
}

async function boot() {
  const newWorldScreen = setupNewWorldScreen({
    onBack() {
      setStatus("Returned to main menu.");
    },
    onCreate(config) {
      const world = createWorldFromConfig(config);
      saveWorld(world);
      renderWorldList();
      newWorldScreen.close();

      const createdMessage = `World created: ${world.worldName} with ${world.topology.hexagonCells} hex cells and ${world.topology.pentagonCells} pent cells.`;
      setStatus(createdMessage);
      return createdMessage;
    },
  });

  renderWorldList();
  mountMainMenu({ onAction: createMenuHandlers(newWorldScreen) });
  setStatus("Main menu online. Loading WebAssembly runtime...");

  try {
    await loadWasmRuntime();
    const multiplayerState = isMultiplayerConnected() ? "connected" : "idle";
    setStatus(`Runtime ready. Servers: ${formatServerSummary()}. Multiplayer ${multiplayerState}.`);
  } catch (error) {
    setStatus(`Runtime failed to load, fallback mode active: ${error.message}`);
  }
}

boot();
