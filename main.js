import { getServerList } from "./client/server-list.js";
import { mountMainMenu, setStatus } from "./main/menu-screen.js";
import { loadWasmRuntime } from "./main/wasm-runtime.js";

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

function handleMenuAction(action, actionLabel) {
  if (action === "quit") {
    setStatus("Quit selected. Closing tab, or falling back to a blank page.");
    tryQuitTab();
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
