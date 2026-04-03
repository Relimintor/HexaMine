import { getServerList } from "./client/server-list.js";
import { mountMainMenu, setStatus } from "./main/menu-screen.js";
import { loadWasmRuntime } from "./main/wasm-runtime.js";

function formatServerSummary() {
  const names = getServerList().map((server) => server.name);
  return names.join(", ");
}

function handleMenuAction(action, actionLabel) {
  if (action === "quit") {
    setStatus("Quit selected. Browser security may block window close in some tabs.");
    window.close();
    return;
  }

  setStatus(`${actionLabel} selected. System wiring in progress.`);
}

async function boot() {
  mountMainMenu({ onAction: handleMenuAction });
  setStatus("Main menu online. Loading WebAssembly runtime...");

  try {
    await loadWasmRuntime();
    setStatus(`Runtime ready. Available servers: ${formatServerSummary()}`);
  } catch (error) {
    setStatus(`Runtime failed to load, fallback mode active: ${error.message}`);
  }
}

boot();
