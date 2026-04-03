import { getServerList } from "./client/server-list.js";
import { mountMainMenu, setStatus } from "./main/menu-screen.js";
import { setupNewWorldScreen } from "./main/new-world-screen.js";
import { loadWasmRuntime } from "./main/wasm-runtime.js";
import { buildIcosphereTopology, mapSizeToSubdivision } from "./main/world/icosphere-topology.js";
import { saveWorld } from "./main/world/world-storage.js";

function formatServerSummary() {
  const names = getServerList().map((server) => server.name);
  return names.join(", ");
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

      setStatus(
        `World saved: ${world.worldName}. Cells ${world.topology.totalCells} (${world.topology.hexagonCells} hex + ${world.topology.pentagonCells} pent).`,
      );
      newWorldScreen.close();
    },
  });

  mountMainMenu({ onAction: createMenuHandlers(newWorldScreen) });
  setStatus("Main menu online. Loading WebAssembly runtime...");

  try {
    await loadWasmRuntime();
    setStatus(`Runtime ready. Available servers: ${formatServerSummary()}`);
  } catch (error) {
    setStatus(`Runtime failed to load, fallback mode active: ${error.message}`);
  }
}

boot();
